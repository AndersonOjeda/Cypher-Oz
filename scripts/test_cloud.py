"""Read-only cloud smoke. It does not certify purchase, backup, scheduler or capacity.

Run with backend/.venv/Scripts/python.exe scripts/test_cloud.py.
Optional direct database check: set CLOUD_DATABASE_URL in the environment.
Exit codes: 0 all requested checks passed; 1 failure; 2 incomplete verification.
"""

import argparse
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def request(url, timeout):
    try:
        with urlopen(
            Request(url, headers={"User-Agent": "CypherOz-Smoke/2.0"}), timeout=timeout
        ) as response:
            return response.status, response.read(2_000_000)
    except HTTPError as exc:
        return exc.code, b""


def check_http(url, expected, timeout, *, health=False, csrf=False):
    try:
        status, body = request(url, timeout)
        valid = status in expected
        if valid and (health or csrf):
            data = json.loads(body)
            if not isinstance(data, dict):
                return "FAIL"
            valid = (
                (data.get("status") == "ok" and data.get("database") == "postgresql")
                if health
                else bool(data.get("csrfToken"))
            )
        return "PASS" if valid else "FAIL"
    except (OSError, URLError, ValueError):
        return "FAIL"


def check_database(connection_string):
    if not connection_string:
        return "SKIP"
    try:
        address = urlsplit(connection_string)
    except ValueError:
        return "FAIL"
    if (
        address.scheme not in {"postgres", "postgresql"}
        or not address.hostname
        or address.hostname in {"localhost", "127.0.0.1", "::1"}
    ):
        return "FAIL"
    try:
        import psycopg
    except ImportError:
        return "SKIP"
    try:
        with (
            psycopg.connect(
                connection_string,
                connect_timeout=15,
                sslmode="require",
                options="-c default_transaction_read_only=on",
            ) as connection,
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "SELECT to_regclass('public.orders'), to_regclass('public.payments'), "
                "to_regclass('public.django_migrations')"
            )
            return "PASS" if all(cursor.fetchone()) else "FAIL"
    except (psycopg.Error, OSError, ValueError):
        # Connection errors can contain credentials: never echo them.
        return "FAIL"


def exit_code(results):
    if any(value == "FAIL" for value in results.values()):
        return 1
    if not results or any(value != "PASS" for value in results.values()):
        return 2
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend", "-b", default="https://tti-staging-api.onrender.com"
    )
    parser.add_argument("--frontend", "-f", default="https://cypher-oz.vercel.app")
    parser.add_argument(
        "--database-env",
        default="CLOUD_DATABASE_URL",
        help="Environment variable holding the optional remote database DSN",
    )
    parser.add_argument("--timeout", "-t", type=int, default=25)
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("timeout must be positive")
    for url in [args.backend, args.frontend]:
        parts = urlsplit(url)
        if (
            parts.scheme != "https"
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
        ):
            parser.error(
                "Cloud URLs must be HTTPS origins without credentials, queries or fragments"
            )
    backend, frontend = args.backend.rstrip("/"), args.frontend.rstrip("/")
    checks = {
        "backend_health": check_http(
            backend + "/health/", {200}, args.timeout, health=True
        ),
        "backend_catalog": check_http(
            backend + "/api/v1/products/", {200}, args.timeout
        ),
        "backend_comparator_validation": check_http(
            backend + "/api/v1/products/compare/?ids=%C2%B2,1", {400}, args.timeout
        ),
        "private_orders_unauthenticated": check_http(
            backend + "/api/v1/admin/orders/", {401, 403}, args.timeout
        ),
        "frontend_catalog": check_http(frontend + "/catalogo", {200}, args.timeout),
        "frontend_comparator": check_http(frontend + "/comparar", {200}, args.timeout),
        "frontend_api_proxy": check_http(
            frontend + "/api/v1/products/", {200}, args.timeout
        ),
        "frontend_csrf": check_http(
            frontend + "/api/v1/auth/csrf/", {200}, args.timeout, csrf=True
        ),
        "direct_remote_database": check_database(os.getenv(args.database_env)),
    }
    code = exit_code(checks)
    print(
        json.dumps(
            {
                "scope": "read-only smoke, not commercial E2E",
                "checks": checks,
                "result": "PASS"
                if code == 0
                else "FAIL"
                if code == 1
                else "INCOMPLETE",
            },
            indent=2,
        )
    )
    return code


if __name__ == "__main__":
    raise SystemExit(main())
