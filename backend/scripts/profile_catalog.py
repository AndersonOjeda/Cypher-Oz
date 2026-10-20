"""Measure isolated catalog queries without HTTP/proxy overhead."""

import argparse
import json
import os
import sys
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.loadtest"

import django

django.setup()

from django.db import connection  # noqa: E402
from django.test import Client  # noqa: E402
from django.test.utils import CaptureQueriesContext  # noqa: E402


def profile():
    client = Client()
    endpoints = {
        "catalog": "/api/v1/products/?page=1",
        "search": "/api/v1/products/?search=Port%C3%A1til&ordering=price",
        "detail": "/api/v1/products/load-product-001/",
    }
    result = {}
    for name, path in endpoints.items():
        client.get(path, HTTP_HOST="localhost")  # warm connection/imports
        samples = []
        for _ in range(5):
            start = perf_counter()
            with CaptureQueriesContext(connection) as queries:
                response = client.get(path, HTTP_HOST="localhost")
            if response.status_code != 200:
                raise RuntimeError(f"{name}: HTTP {response.status_code}")
            samples.append(
                {
                    "elapsed_ms": round((perf_counter() - start) * 1000, 2),
                    "queries": len(queries),
                    "db_ms": round(sum(float(q["time"]) for q in queries) * 1000, 2),
                }
            )
        result[name] = {"samples": samples, "sql": [q["sql"] for q in queries]}
    return result


def explain(source):
    """Use only captured SELECTs against the dedicated local test database."""
    from django.conf import settings

    db = settings.DATABASES["default"]
    if db["NAME"] != "tti_loadtest" or db["HOST"] not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("EXPLAIN only accepts the local tti_loadtest database")
    captured = json.loads(source.read_text(encoding="utf-8"))
    plans = {}
    for endpoint, data in captured.items():
        query = data["sql"][0 if endpoint == "detail" else 1]
        if not query.startswith("SELECT ") or ";" in query:
            raise ValueError("Expected a single captured SELECT")
        with connection.cursor() as cursor:
            cursor.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query)
            plans[endpoint] = cursor.fetchone()[0][0]
    return plans


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--explain-source", type=Path)
    args = parser.parse_args()
    result = explain(args.explain_source) if args.explain_source else profile()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    if args.explain_source:
        print(
            json.dumps(
                {
                    key: {
                        "execution_ms": value["Execution Time"],
                        "rows": value["Plan"]["Actual Rows"],
                    }
                    for key, value in result.items()
                },
                indent=2,
            )
        )
    else:
        print(json.dumps({key: value["samples"] for key, value in result.items()}, indent=2))
