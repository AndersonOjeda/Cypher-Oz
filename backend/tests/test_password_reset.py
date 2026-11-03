import json
import re
from datetime import timedelta
from unittest.mock import patch
from urllib.error import URLError

import pytest
from django.core import mail
from django.test import override_settings
from django.utils import timezone

from apps.users.email import send_verification_email
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
    BREVO_API_KEY="xkeysib_test",
    BREVO_FROM_EMAIL="no-reply@example.com",
    BREVO_FROM_NAME="Cypher Oz",
)
@patch("apps.users.email.urlopen")
def test_request_uses_brevo_transactional_email_api(urlopen, client, user):
    urlopen.return_value.__enter__.return_value.read.return_value = b'{"messageId":"email_1"}'

    response = client.post(REQUEST, {"email": user.email}, format="json")

    assert response.status_code == 200
    request = urlopen.call_args.args[0]
    assert request.full_url == "https://api.brevo.com/v3/smtp/email"
    assert request.headers["Api-key"] == "xkeysib_test"
    assert request.headers["User-agent"] == "CypherOz/1.0"
    payload = json.loads(request.data.decode("utf-8"))
    assert payload["sender"] == {"name": "Cypher Oz", "email": "no-reply@example.com"}
    assert payload["to"] == [{"email": user.email}]
    assert "token=" in payload["textContent"]
    assert "Crear nueva contraseña" in payload["htmlContent"]
    assert "token=" in payload["htmlContent"]


@override_settings(
    BREVO_API_KEY="xkeysib_test",
    BREVO_FROM_EMAIL="no-reply@example.com",
    BREVO_FROM_NAME="Cypher Oz",
)
@patch("apps.users.email.urlopen")
def test_verification_uses_brevo_transactional_email_api(urlopen):
    urlopen.return_value.__enter__.return_value.read.return_value = b'{"messageId":"email_2"}'

    result = send_verification_email("client@example.com", "https://example.com/verify?token=t1")

    assert result == {"messageId": "email_2"}
    request = urlopen.call_args.args[0]
    payload = json.loads(request.data.decode("utf-8"))
    assert request.full_url == "https://api.brevo.com/v3/smtp/email"
    assert payload["to"] == [{"email": "client@example.com"}]
    assert "token=t1" in payload["textContent"]
    assert "Verificar mi correo" in payload["htmlContent"]
    assert "token=t1" in payload["htmlContent"]


@pytest.mark.django_db
@override_settings(
    BREVO_API_KEY="xkeysib_test",
    BREVO_FROM_EMAIL="no-reply@example.com",
)
@patch("apps.users.email.urlopen", side_effect=URLError("unavailable"))
def test_request_returns_503_and_discards_token_when_brevo_fails(urlopen, client, user):
    response = client.post(REQUEST, {"email": user.email}, format="json")

    assert response.status_code == 503
    assert response.data["code"] == "email_service_unavailable"
    assert not PasswordResetToken.objects.filter(user=user).exists()


@pytest.mark.django_db
@override_settings(BREVO_API_KEY="xkeysib_test", BREVO_FROM_EMAIL="")
@patch("apps.users.email.urlopen")
def test_request_returns_503_and_discards_token_without_brevo_sender(urlopen, client, user):
    response = client.post(REQUEST, {"email": user.email}, format="json")

    assert response.status_code == 503
    assert response.data["code"] == "email_service_unavailable"
    assert not PasswordResetToken.objects.filter(user=user).exists()
    urlopen.assert_not_called()


@pytest.mark.django_db
@override_settings(BREVO_API_KEY="")
@patch("apps.users.email.EmailMultiAlternatives.send", side_effect=OSError("blocked"))
def test_request_returns_503_when_smtp_is_unavailable(send, client, user):
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
