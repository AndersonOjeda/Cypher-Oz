import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "cloud_smoke", Path(__file__).resolve().parents[2] / "scripts" / "test_cloud.py"
)
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


def test_skipped_database_does_not_certify_cloud():
    assert smoke.check_database(None) == "SKIP"
    assert smoke.exit_code({"health": "PASS", "database": "SKIP"}) == 2
    assert smoke.exit_code({}) == 2


def test_local_database_is_not_a_cloud_check():
    assert smoke.check_database("postgresql://localhost/local") == "FAIL"


@pytest.mark.parametrize("body", [b"{}", b'{"status":"ok","database":"unavailable"}', b"not json"])
def test_http_200_without_database_health_is_not_success(monkeypatch, body):
    monkeypatch.setattr(smoke, "request", lambda *_: (200, body))
    assert smoke.check_http("https://example.com/health/", {200}, 1, health=True) == "FAIL"


def test_defaults_never_load_local_application_environment(monkeypatch, capsys):
    urls = []
    monkeypatch.delenv("CLOUD_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/local")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
    monkeypatch.setattr(
        smoke, "check_http", lambda url, *_args, **_kwargs: urls.append(url) or "PASS"
    )
    assert smoke.main([]) == 2
    assert all(url.startswith("https://") for url in urls)
    assert "INCOMPLETE" in capsys.readouterr().out
