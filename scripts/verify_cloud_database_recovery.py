"""Read a remote DSN from stdin, back up a consistent snapshot and restore locally."""

import getpass
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

import psycopg
from dotenv import dotenv_values
from psycopg import sql


def inventory(conn):
    conn.execute("SET TIME ZONE 'UTC'")
    conn.execute("SET DateStyle TO ISO")
    tables = conn.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    ).fetchall()
    result = {}
    for (table,) in tables:
        rows = conn.execute(
            sql.SQL("SELECT row_to_json(t)::text FROM {} t").format(
                sql.Identifier("public", table)
            )
        ).fetchall()
        # Compare all rows without persisting any row contents in the public report.
        digest = hashlib.sha256()
        for row in sorted(value[0] for value in rows):
            digest.update(row.encode())
            digest.update(b"\n")
        result[table] = {"rows": len(rows), "sha256": digest.hexdigest()}
    return result


def main():
    print("READY_FOR_EPHEMERAL_DSN", flush=True)
    if not sys.stdin.isatty():
        raise ValueError("A console with hidden input is required")
    dsn = getpass.getpass("Ephemeral database connection (hidden): ").strip()
    address = urlsplit(dsn)
    if (
        address.scheme not in {"postgres", "postgresql"}
        or not address.hostname
        or not address.hostname.endswith(".render.com")
        or address.path != "/tti_staging"
    ):
        raise ValueError("Expected the existing remote staging database")
    root = Path(__file__).resolve().parents[1]
    local = dotenv_values(root / "backend/.env")["DATABASE_URL"]
    if urlsplit(local).hostname not in {"localhost", "127.0.0.1"}:
        raise ValueError("Restore destination must be local")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    target = "tti_cloud_restore_" + stamp
    dump = root / ".runtime" / ("remote-postgres-" + stamp + ".dump")
    container = "cypher-oz-postgres-1"

    def docker(*command, **kwargs):
        return subprocess.run(
            ["docker", "exec", "-i", container, *command],
            check=True,
            stderr=subprocess.PIPE,
            **kwargs,
        )

    with psycopg.connect(dsn, sslmode="require", connect_timeout=20) as remote:
        remote.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        snapshot = remote.execute("SELECT pg_export_snapshot()").fetchone()[0]
        source = inventory(remote)
        env = {**os.environ, "PGPASSWORD": unquote(address.password or "")}
        with dump.open("xb") as output:
            subprocess.run(
                [
                    "docker",
                    "exec",
                    "-i",
                    "-e",
                    "PGPASSWORD",
                    "-e",
                    "PGSSLMODE=require",
                    container,
                    "pg_dump",
                    "-h",
                    address.hostname,
                    "-U",
                    unquote(address.username),
                    "-d",
                    "tti_staging",
                    "-Fc",
                    "--no-owner",
                    "--no-acl",
                    "--snapshot",
                    snapshot,
                ],
                env=env,
                stdout=output,
                stderr=subprocess.PIPE,
                check=True,
                timeout=180,
            )
        env.pop("PGPASSWORD")
    docker("createdb", "-U", "tti", target, stdout=subprocess.DEVNULL)
    try:
        with dump.open("rb") as archive:
            docker(
                "pg_restore",
                "-U",
                "tti",
                "-d",
                target,
                "--no-owner",
                "--no-acl",
                "--exit-on-error",
                stdin=archive,
                stdout=subprocess.DEVNULL,
            )
        parts = psycopg.conninfo.conninfo_to_dict(local)
        parts["dbname"] = target
        with psycopg.connect(**parts, connect_timeout=15) as restored:
            actual = inventory(restored)
        if actual != source:
            raise RuntimeError(
                "Restored table contents differ from the source snapshot"
            )
    finally:
        # Only this invocation's successfully created local database is removed.
        docker("dropdb", "-U", "tti", target, stdout=subprocess.DEVNULL)
    evidence = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Remote Render PostgreSQL snapshot restored into isolated local PostgreSQL",
        "result": "PASS",
        "tls": "required",
        "source_transaction": "read-only repeatable-read",
        "all_table_rows_and_digests_match": True,
        "tables": {name: entry["rows"] for name, entry in source.items()},
        "table_count": len(source),
        "dump_sha256": hashlib.sha256(dump.read_bytes()).hexdigest(),
        "source_modified": False,
        "isolated_restore_database_removed": True,
        "dsn_persisted": False,
        "data_dump_location": "ignored .runtime directory; not published",
    }
    path = root / "docs/evidence/sprint-8/cloud-database-recovery-2026-11-10.json"
    path.write_text(
        json.dumps(evidence, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(evidence), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - connection errors may contain credentials
        print(
            json.dumps({"result": "FAIL", "error_type": type(exc).__name__}), flush=True
        )
        raise SystemExit(1) from None
