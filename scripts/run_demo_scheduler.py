"""Run payment deadlines for the isolated classroom database only."""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="Apply deadlines; default is dry-run"
    )
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    parser.add_argument(
        "--interval", type=int, default=300, help="Seconds between cycles (minimum 30)"
    )
    args = parser.parse_args()
    if args.interval < 30:
        parser.error("--interval must be at least 30 seconds")
    root = Path(__file__).resolve().parents[1]
    runtime = root / ".runtime"
    runtime.mkdir(exist_ok=True)
    # The child settings enforce a loopback DB host and tti_sprint1_demo database.
    env = {**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.demo"}
    command = [
        sys.executable,
        "manage.py",
        "process_payment_deadlines",
        "--actor-email",
        "admin@sprint1.example",
        "--limit",
        "100",
    ]
    if not args.apply:
        command.append("--dry-run")
    lock_path = runtime / "demo-scheduler.lock"
    try:
        lock = lock_path.open("x", encoding="utf-8")
    except FileExistsError:
        parser.exit(
            1,
            "Another scheduler may be running. Inspect .runtime/demo-scheduler.lock first.\n",
        )
    try:
        with lock:
            lock.write(str(os.getpid()))
            lock.flush()
            while True:
                started = time.monotonic()
                try:
                    result = subprocess.run(
                        command,
                        cwd=root / "backend",
                        env=env,
                        capture_output=True,
                        text=True,
                        timeout=120,
                        check=False,
                    )
                except subprocess.TimeoutExpired:
                    result = subprocess.CompletedProcess(
                        command, 124, stdout='{"error": "Deadline command timed out"}'
                    )
                # Persist only the command's structured result, not stderr or credentials.
                try:
                    payload = json.loads(result.stdout)
                except ValueError:
                    payload = {
                        "error": "No structured command output; inspect the command locally"
                    }
                record = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "scope": "isolated local demo; not the remote scheduler",
                    "dry_run": not args.apply,
                    "exit_code": result.returncode,
                    "result": payload,
                }
                with (runtime / "demo-scheduler.jsonl").open(
                    "a", encoding="utf-8"
                ) as log:
                    log.write(json.dumps(record) + "\n")
                print(json.dumps(record), flush=True)
                if result.returncode:
                    return result.returncode
                if args.once:
                    return 0
                time.sleep(max(0, args.interval - (time.monotonic() - started)))
    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Demo scheduler stopped.")
