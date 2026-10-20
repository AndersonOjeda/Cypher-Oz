"""Summarize Django measurements within a completed load container's time range."""

import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from analyze import percentile


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("log", type=Path)
    parser.add_argument("--since", type=timestamp, required=True)
    parser.add_argument("--until", type=timestamp, required=True)
    args = parser.parse_args()
    groups = defaultdict(list)
    for source in args.log.parent.glob(args.log.name + "*"):
        for line in source.read_text(encoding="utf-8").splitlines():
            record = json.loads(line)
            if args.since <= record.get("time", 0) <= args.until:
                groups[record["route"]].append(record)
    result = {}
    for route, records in sorted(groups.items()):
        result[route] = {
            "requests": len(records),
            "app_p95_ms": percentile([r["elapsed_ms"] for r in records], .95),
            "db_p95_ms": percentile([r["db_ms"] for r in records], .95),
            "query_counts": sorted({r["queries"] for r in records}),
            "errors": sum(r["status"] >= 400 for r in records),
        }
    print(json.dumps(result, indent=2))
