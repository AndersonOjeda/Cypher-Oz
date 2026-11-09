"""Verify recovery of synthetic local data without touching the source database."""

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=["tti_e2e", "tti_sprint1_demo"], default="tti_e2e")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    runtime = root / ".runtime"
    runtime.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    target = f"tti_restore_verification_{stamp}"
    dump = runtime / f"{args.source}-{stamp}.dump"
    container = "cypher-oz-postgres-1"

    def docker(*command, **kwargs):
        return subprocess.run(
            ["docker", "exec", "-i", container, *command], check=True, **kwargs
        )

    def counts(database):
        sql = (
            "SELECT 'tables',count(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_type='BASE TABLE' "
            "UNION ALL SELECT 'migrations',count(*) FROM django_migrations "
            "UNION ALL SELECT 'orders',count(*) FROM orders "
            "UNION ALL SELECT 'payments',count(*) FROM payments "
            "UNION ALL SELECT 'reviews',count(*) FROM product_reviews ORDER BY 1"
        )
        result = docker(
            "psql", "-U", "tti", "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql,
            capture_output=True, text=True,
        )
        return dict(line.split("|") for line in result.stdout.strip().splitlines())

    with dump.open("wb") as output:
        docker("pg_dump", "-U", "tti", "-Fc", args.source, stdout=output)
    docker("createdb", "-U", "tti", target)
    # Only a database created successfully by this invocation can reach cleanup.
    try:
        with dump.open("rb") as source:
            docker(
                "pg_restore", "-U", "tti", "--exit-on-error", "--no-owner", "-d", target,
                stdin=source,
            )
        source_counts, restored_counts = counts(args.source), counts(target)
        if source_counts != restored_counts:
            raise RuntimeError("Source changed or restored counts differ; repeat after E2E ends")
        result = {
            "scope": "synthetic local PostgreSQL; excludes remote data and object storage",
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "source": args.source,
            "restored_counts": restored_counts,
            "dump_sha256": hashlib.sha256(dump.read_bytes()).hexdigest(),
            "result": "PASS",
        }
    finally:
        docker("dropdb", "-U", "tti", target)
    evidence = root / "docs/evidence/sprint-8/local-recovery-2026-11-09.json"
    evidence.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
