import re
from datetime import timedelta
from unittest.mock import patch
from urllib.error import URLError

import pytest
from django.core import mail
from django.test import override_settings
from django.utils import timezone

from apps.users.models import AuthSession, PasswordResetToken

REQUEST = "/api/v1/auth/password-reset/request/"
CONFIRM = "/api/v1/auth/password-reset/confirm/"
NEW_PASSWORD = "Nueva-clave!Segura9842"


def token_from_email():
    return re.search(r"token=([^\s]+)", mail.outbox[-1].body).group(1)


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_request_is_generic_and_stores_only_hash(client, user):
    existing = client.post(REQUEST, {"email": user.email}, format="json")
    assert existing.status_code == 200
    token = token_from_email()
    reset = PasswordResetToken.objects.get(user=user)
    assert token not in reset.token_hash
    assert len(reset.token_hash) == 64

    unknown = client.post(REQUEST, {"email": "nadie@example.com"}, format="json")
    assert unknown.status_code == 200
    assert unknown.data == existing.data
    assert len(mail.outbox) == 1


@pytest.mark.django_db
@override_settings(
    RESEND_API_KEY="re_test",
    RESEND_FROM_EMAIL="Cypher Oz <onboarding@resend.dev>",
)
@patch("apps.users.email.urlopen")
def test_request_uses_resend_http_api(urlopen, client, user):
    urlopen.return_value.__enter__.return_value.read.return_value = b'{"id":"email_1"}'

    response = client.post(REQUEST, {"email": user.email}, format="json")

    assert response.status_code == 200
    request = urlopen.call_args.args[0]
    assert request.full_url == "https://api.resend.com/emails"
    assert request.headers["Authorization"] == "Bearer re_test"
    assert request.headers["User-agent"] == "CypherOz/1.0"
    assert user.email in request.data.decode("utf-8")


@pytest.mark.django_db
@override_settings(RESEND_API_KEY="re_test")
@patch("apps.users.email.urlopen", side_effect=URLError("unavailable"))
def test_request_returns_503_and_discards_token_when_resend_fails(urlopen, client, user):
    response = client.post(REQUEST, {"email": user.email}, format="json")

    assert response.status_code == 503
    assert response.data["code"] == "email_service_unavailable"
    assert not PasswordResetToken.objects.filter(user=user).exists()


@pytest.mark.django_db
@override_settings(RESEND_API_KEY="")
@patch("apps.users.email.send_mail", side_effect=OSError("blocked"))
def test_request_returns_503_when_smtp_is_unavailable(send_mail, client, user):
    response = client.post(REQUEST, {"email": user.email}, format="json")

    assert response.status_code == 503
    assert response.data["code"] == "email_service_unavailable"
    assert not PasswordResetToken.objects.filter(user=user).exists()


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_valid_token_changes_password_once_and_revokes_sessions(client, user):
    login = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": "Una-clave!Distinta8472"},
        format="json",
    )
    assert login.status_code == 200 and AuthSession.objects.filter(user=user).exists()
    client.credentials(HTTP_X_CSRFTOKEN=login.data["csrfToken"])
    client.post(REQUEST, {"email": user.email}, format="json")
    token = token_from_email()

    changed = client.post(
        CONFIRM,
        {"token": token, "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD},
        format="json",
    )
    assert changed.status_code == 200
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    assert AuthSession.objects.filter(user=user, revoked_at__isnull=True).count() == 0
    assert (
        client.post(
            CONFIRM,
            {"token": token, "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD},
            format="json",
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "Una-clave!Distinta8472"},
            format="json",
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login/", {"email": user.email, "password": NEW_PASSWORD}, format="json"
        ).status_code
        == 200
    )


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_invalid_expired_and_mismatched_password_are_rejected(client, user):
    assert (
        client.post(
            CONFIRM,
            {"token": "x" * 40, "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD},
            format="json",
        ).status_code
        == 400
    )
    client.post(REQUEST, {"email": user.email}, format="json")
    token = token_from_email()
    reset = PasswordResetToken.objects.get(user=user)
    reset.expires_at = timezone.now() - timedelta(seconds=1)
    reset.save(update_fields=["expires_at"])
    assert (
        client.post(
            CONFIRM,
            {"token": token, "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD},
            format="json",
        ).status_code
        == 400
    )
    mismatch = client.post(
        CONFIRM,
        {"token": "z" * 40, "password": NEW_PASSWORD, "password_confirm": "Otra-clave!123"},
        format="json",
    )
    assert mismatch.status_code == 400
