from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from .test_order_expiration import due_order
from .test_sprint5_backend import sprint5_setup as sprint5_setup

URL = "/api/v1/ops/payment-deadlines/"
TOKEN = "test-only-job-token-" + "a" * 40


@pytest.mark.django_db
@pytest.mark.parametrize("provided", ["", "Bearer wrong", "Bearer inválido"])
def test_job_rejects_missing_or_invalid_machine_credentials(settings, provided):
    settings.OPS_SCHEDULER_TOKEN = TOKEN
    response = APIClient(enforce_csrf_checks=True).post(
        URL, {}, format="json", HTTP_AUTHORIZATION=provided
    )
    assert response.status_code == 404
    assert response["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_job_is_disabled_without_configuration(settings):
    settings.OPS_SCHEDULER_TOKEN = ""
    assert APIClient().post(URL, {}, format="json").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize("body", [{"limit": 1000}, {"dry_run": "false"}, []])
def test_job_rejects_unexpected_or_unsafe_input(settings, body):
    settings.OPS_SCHEDULER_TOKEN = TOKEN
    response = APIClient().post(URL, body, format="json", HTTP_AUTHORIZATION=f"Bearer {TOKEN}")
    assert response.status_code == 400


def test_job_processes_persisted_deadline_once_and_supports_dry_run(settings, sprint5_setup):
    settings.OPS_SCHEDULER_TOKEN = TOKEN
    settings.OPS_SCHEDULER_ACTOR_EMAIL = sprint5_setup["admin"].email
    order = due_order(sprint5_setup)
    client = APIClient(enforce_csrf_checks=True)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {TOKEN}")
    assert client.get(URL).status_code == 405
    response = client.post(URL, {"dry_run": True}, format="json")
    assert response.status_code == 200
    assert response.data["candidates"] == 1
    order.refresh_from_db()
    assert order.status == "PENDING"
    for expected in (1, 0):
        response = client.post(URL, {}, format="json")
        assert response.status_code == 200
        assert response.data["cancelled"] == expected
        assert response.data["failed_count"] == 0
    order.refresh_from_db()
    assert order.status == "CANCELLED"


@pytest.mark.django_db
def test_job_requires_existing_active_admin(settings, user):
    settings.OPS_SCHEDULER_TOKEN = TOKEN
    settings.OPS_SCHEDULER_ACTOR_EMAIL = user.email
    response = APIClient().post(URL, {}, format="json", HTTP_AUTHORIZATION=f"Bearer {TOKEN}")
    assert response.status_code == 503


def test_job_failure_reports_no_order_identifiers(settings, sprint5_setup):
    settings.OPS_SCHEDULER_TOKEN = TOKEN
    settings.OPS_SCHEDULER_ACTOR_EMAIL = sprint5_setup["admin"].email
    result = dict(candidates=1, cancelled=0, alerted=0, skipped=0, failed=["private-order"])
    with patch("apps.core.operations.process_payment_deadlines", return_value=result):
        response = APIClient().post(URL, {}, format="json", HTTP_AUTHORIZATION=f"Bearer {TOKEN}")
    assert response.status_code == 503
    assert response.data["failed_count"] == 1
    assert b"private-order" not in response.content
