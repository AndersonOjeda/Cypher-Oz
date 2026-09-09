from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from django.db import IntegrityError, close_old_connections, connections, transaction
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.users.models import AuthSession, User
from apps.users.serializers import DuplicateEmail, RegisterSerializer
from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db
REGISTER = "/api/v1/auth/register/"
LOGIN = "/api/v1/auth/login/"
ME = "/api/v1/users/me/"


def test_register_persists_hash_and_client_role(client):
    r = client.post(
        REGISTER,
        {"name": "Ana Torres", "email": "ANA@example.com", "password": PASSWORD},
        format="json",
    )
    assert r.status_code == 201
    user = User.objects.get(email="ana@example.com")
    assert user.check_password(PASSWORD) and user.password != PASSWORD
    assert user.role == "CLIENT"
    assert "password" not in r.data
    assert r["Cache-Control"] == "no-store"


def test_duplicate_email_case_insensitive(client, user):
    r = client.post(
        REGISTER, {"name": "Otra", "email": user.email.upper(), "password": PASSWORD}, format="json"
    )
    assert r.status_code == 409
    assert r.data["code"] == "EMAIL_ALREADY_EXISTS"
    assert User.objects.count() == 1


@pytest.mark.parametrize(
    "change",
    [
        {"name": " "},
        {"email": "incorrecto"},
        {"password": "123"},
        {"password": "1234567890"},
        {"password": "password"},
        {"password": ""},
        {"password": "x" * 129},
        {"role": "ADMIN"},
        {"is_active": True},
    ],
)
def test_invalid_registration_never_creates_user(client, change):
    r = client.post(
        REGISTER,
        {"name": "Ana Torres", "email": "ana@example.com", "password": PASSWORD, **change},
        format="json",
    )
    assert r.status_code == 400
    assert User.objects.count() == 0


def test_database_enforces_unique_email(user):
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create(email=user.email.upper(), name="Duplicado", password="hashed")


def test_database_enforces_roles():
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create(email="x@example.com", name="X", role="SELLER")


def test_login_cookie_security_and_no_tokens_in_body(client, user, settings):
    settings.AUTH_COOKIE_SECURE = True
    r = client.post(LOGIN, {"email": user.email.upper(), "password": PASSWORD}, format="json")
    assert r.status_code == 200
    for name in ["tti_access", "tti_refresh"]:
        assert r.cookies[name]["httponly"]
        assert r.cookies[name]["secure"]
        assert r.cookies[name]["samesite"] == "Lax"
        assert r.cookies[name]["path"] == "/api/v1/"
    assert "access" not in r.data and "refresh" not in r.data


@pytest.mark.parametrize(
    "email,password",
    [
        ("cliente@example.com", "incorrecta"),
        ("nadie@example.com", PASSWORD),
    ],
)
def test_invalid_credentials_generic_401(client, user, email, password):
    r = client.post(LOGIN, {"email": email, "password": password}, format="json")
    assert r.status_code == 401
    assert r.data["message"] == "Correo o contraseña incorrectos."
    assert not AuthSession.objects.exists()


def test_inactive_user_cannot_login(client, user):
    user.is_active = False
    user.save()
    assert (
        client.post(LOGIN, {"email": user.email, "password": PASSWORD}, format="json").status_code
        == 401
    )


def test_protected_without_session(client):
    assert client.get(ME).status_code == 401


def test_protected_with_session(logged_in, user):
    assert logged_in.get(ME).data["email"] == user.email


def test_client_denied_admin(logged_in, user):
    assert logged_in.get("/api/v1/admin/settings/").status_code == 403
    user.refresh_from_db()
    assert user.role == "CLIENT"


def test_admin_allowed(logged_in, user):
    user.role = "ADMIN"
    user.save()
    assert logged_in.get("/api/v1/admin/settings/").status_code == 200


def test_refresh_rotates_and_rejects_old_token(logged_in):
    old = logged_in.cookies["tti_refresh"].value
    assert logged_in.post("/api/v1/auth/refresh/").status_code == 200
    assert logged_in.cookies["tti_refresh"].value != old
    assert logged_in.get(ME).status_code == 200
    logged_in.cookies["tti_refresh"] = old
    assert logged_in.post("/api/v1/auth/refresh/").status_code == 401


def test_expired_access_can_refresh(logged_in):
    token = AccessToken(logged_in.cookies["tti_access"].value)
    token.set_exp(from_time=timezone.now() - timedelta(hours=1))
    logged_in.cookies["tti_access"] = str(token)
    assert logged_in.get(ME).status_code == 401
    assert logged_in.post("/api/v1/auth/refresh/").status_code == 200
    assert logged_in.get(ME).status_code == 200


def test_logout_revokes_copied_access_and_refresh(logged_in):
    access = logged_in.cookies["tti_access"].value
    refresh = logged_in.cookies["tti_refresh"].value
    assert logged_in.post("/api/v1/auth/logout/").status_code == 204
    assert logged_in.get(ME).status_code == 401
    logged_in.cookies["tti_access"] = access
    logged_in.cookies["tti_refresh"] = refresh
    assert logged_in.get(ME).status_code == 401
    token = logged_in.get("/api/v1/auth/csrf/").data["csrfToken"]
    logged_in.credentials(HTTP_X_CSRFTOKEN=token)
    assert logged_in.post("/api/v1/auth/refresh/").status_code == 401


@pytest.mark.parametrize("path", [REGISTER, LOGIN, "/api/v1/auth/refresh/", "/api/v1/auth/logout/"])
def test_auth_requires_csrf(path):
    assert APIClient(enforce_csrf_checks=True).post(path, {}, format="json").status_code == 403


def test_untrusted_origin_rejected(client):
    r = client.post(
        REGISTER,
        {"name": "Ana", "email": "ana@example.com", "password": PASSWORD},
        format="json",
        HTTP_ORIGIN="https://evil.example",
    )
    assert r.status_code == 403
    assert User.objects.count() == 0


def test_disabled_user_existing_session_rejected(logged_in, user):
    user.is_active = False
    user.save()
    assert logged_in.get(ME).status_code == 401
    assert logged_in.post("/api/v1/auth/refresh/").status_code == 401


def test_throttle_rejects_excessive_login(client):
    statuses = [
        client.post(
            LOGIN, {"email": "nobody@example.com", "password": "bad"}, format="json"
        ).status_code
        for _ in range(31)
    ]
    assert statuses[-1] == 429


def test_racing_duplicate_is_controlled(client):
    serializer = RegisterSerializer(
        data={"name": "Ana", "email": "ana@example.com", "password": PASSWORD}
    )
    assert serializer.is_valid()
    User.objects.create_user("ana@example.com", PASSWORD, name="Ana")
    with pytest.raises(DuplicateEmail):
        serializer.save()
    assert User.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_refresh_only_one_succeeds(logged_in):
    cookies = {key: value.value for key, value in logged_in.cookies.items()}
    csrf = logged_in._credentials["HTTP_X_CSRFTOKEN"]

    def refresh():
        close_old_connections()
        try:
            c = APIClient(enforce_csrf_checks=True)
            for key, value in cookies.items():
                c.cookies[key] = value
            c.credentials(HTTP_X_CSRFTOKEN=csrf)
            return c.post("/api/v1/auth/refresh/").status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(lambda _: refresh(), range(2)))
    assert sorted(statuses) == [200, 401]
