"""Summarize k6 samples by completion time and endpoint (milliseconds)."""

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def percentile(values, fraction):
    ordered = sorted(values)
    if not ordered:
        return None
    index = (len(ordered) - 1) * fraction
    lower = int(index)
    upper = min(lower + 1, len(ordered) - 1)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower), 2)


def analyze(source):
    durations = []
    concurrency = []
    statuses = defaultdict(int)
    with source.open(encoding="utf-8") as stream:
        for line in stream:
            point = json.loads(line)
            if point.get("type") != "Point":
                continue
            data = point["data"]
            time = datetime.fromisoformat(data["time"].replace("Z", "+00:00")).timestamp()
            if point["metric"] == "vus":
                concurrency.append((time, data["value"]))
            if point["metric"] == "http_req_duration":
                tags = data.get("tags", {})
                statuses[tags.get("status", "unknown")] += 1
                if tags.get("endpoint") != "preflight":
                    durations.append((time, tags.get("endpoint"), data["value"]))
    if not concurrency or not durations:
        raise ValueError("Missing request or virtual-user samples")
    # k6 emits the first VU gauge about one second after the scenario starts.
    origin = min(t for t, _ in concurrency) - 1
    buckets = defaultdict(list)
    endpoints = defaultdict(list)
    for time, endpoint, duration in durations:
        buckets[int(max(0, time - origin) // 30) * 30].append(duration)
        endpoints[endpoint].append(duration)
    result = {
        "max_observed_vus": max(value for _, value in concurrency),
        "statuses_including_preflight": dict(statuses),
        "endpoints": {name: {"requests": len(values), "p95_ms": percentile(values, .95),
                             "p99_ms": percentile(values, .99)}
                      for name, values in sorted(endpoints.items())},
        "completion_windows_approximate": [
            {"start_s": start, "end_s": start + 30, "requests": len(values),
             "requests_per_s": round(len(values) / 30, 2), "p95_ms": percentile(values, .95)}
            for start, values in sorted(buckets.items())
        ],
    }
    return result


if __name__ == "__main__":
    print(json.dumps(analyze(Path(sys.argv[1])), indent=2))
