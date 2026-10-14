import re
from datetime import timedelta

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
