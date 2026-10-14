from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest
from django.db import IntegrityError, close_old_connections, connections, transaction
from rest_framework.test import APIClient

from apps.users.models import Address, User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db
ME = "/api/v1/users/me/"
ADDRESSES = f"{ME}addresses/"
PAYLOAD = {
    "label": "Casa",
    "recipient_name": "Ana",
    "phone": "3001234567",
    "address_line": "Calle 20 # 12-30",
    "city": "Pasto",
    "state": "Narino",
}


@pytest.mark.parametrize(
    "payload", [{"name": " "}, {"email": "bad"}, {"is_active": False}, {"password": "another"}]
)
def test_invalid_profile_does_not_change_user(logged_in, user, payload):
    original = (user.name, user.email, user.password, user.is_active)
    assert logged_in.patch(ME, payload, format="json").status_code == 400
    user.refresh_from_db()
    assert (user.name, user.email, user.password, user.is_active) == original


@pytest.mark.parametrize("email", ["other@example.com", "OTHER@example.com"])
def test_profile_duplicate_email_is_conflict(logged_in, user, email):
    User.objects.create_user("other@example.com", PASSWORD, name="Other")
    assert logged_in.patch(ME, {"email": email}, format="json").status_code == 409
    user.refresh_from_db()
    assert user.email == "cliente@example.com"


@pytest.mark.parametrize(
    "field", ["label", "recipient_name", "phone", "address_line", "city", "state"]
)
def test_blank_address_field_is_rejected(logged_in, field):
    response = logged_in.post(ADDRESSES, {**PAYLOAD, field: " "}, format="json")
    assert response.status_code == 400
    assert field in response.data["details"]
    assert not Address.objects.exists()


def test_address_owner_and_identity_cannot_be_assigned(logged_in, user):
    for extra in [{"user": user.pk}, {"id": 123}]:
        assert logged_in.post(ADDRESSES, {**PAYLOAD, **extra}, format="json").status_code == 400
    assert not Address.objects.exists()


def test_foreign_address_cannot_be_read_changed_or_deleted(logged_in):
    other = User.objects.create_user("other@example.com", PASSWORD, name="Other")
    address = Address.objects.create(user=other, **PAYLOAD)
    path = f"{ADDRESSES}{address.pk}/"
    assert logged_in.get(path).status_code == 404
    assert logged_in.patch(path, {"label": "Changed"}, format="json").status_code == 404
    assert logged_in.delete(path).status_code == 404
    address.refresh_from_db()
    assert address.label == "Casa"
    assert logged_in.get(ADDRESSES).data == []


def test_profile_and_address_mutations_require_session_and_csrf(logged_in, user):
    address = Address.objects.create(user=user, **PAYLOAD)
    operations = [
        ("patch", ME, {"name": "Changed"}),
        ("post", ADDRESSES, PAYLOAD),
        ("patch", f"{ADDRESSES}{address.pk}/", {"label": "Changed"}),
        ("delete", f"{ADDRESSES}{address.pk}/", {}),
    ]
    anonymous = APIClient(enforce_csrf_checks=True)
    logged_in.credentials()
    for method, path, payload in operations:
        assert getattr(anonymous, method)(path, payload, format="json").status_code == 401
        assert getattr(logged_in, method)(path, payload, format="json").status_code == 403
    address.refresh_from_db()
    assert address.label == "Casa"


def test_default_address_switch_and_rollback(logged_in, user):
    first = logged_in.post(ADDRESSES, PAYLOAD, format="json").data
    second = logged_in.post(
        ADDRESSES, {**PAYLOAD, "label": "Work", "is_default": True}, format="json"
    ).data
    assert list(user.addresses.filter(is_default=True).values_list("pk", flat=True)) == [
        second["id"]
    ]
    response = logged_in.patch(f"{ADDRESSES}{first['id']}/", {"is_default": True}, format="json")
    assert response.status_code == 200
    assert list(user.addresses.filter(is_default=True).values_list("pk", flat=True)) == [
        first["id"]
    ]
    with patch(
        "apps.users.serializers.Address.objects.create", side_effect=RuntimeError("write failed")
    ):
        with pytest.raises(RuntimeError):
            logged_in.post(ADDRESSES, {**PAYLOAD, "is_default": True}, format="json")
    assert user.addresses.get(is_default=True).pk == first["id"]
    assert logged_in.get(ME)["Cache-Control"] == "no-store"
    assert len(logged_in.get(ME).data["addresses"]) == 2


def test_database_prevents_multiple_defaults(user):
    Address.objects.create(user=user, is_default=True, **PAYLOAD)
    with pytest.raises(IntegrityError), transaction.atomic():
        Address.objects.create(user=user, is_default=True, **PAYLOAD)


@pytest.mark.django_db(transaction=True)
def test_concurrent_first_addresses_leave_one_default(logged_in, user):
    cookies = {key: value.value for key, value in logged_in.cookies.items()}
    csrf = logged_in._credentials["HTTP_X_CSRFTOKEN"]

    def create(index):
        close_old_connections()
        try:
            client = APIClient(enforce_csrf_checks=True)
            for key, value in cookies.items():
                client.cookies[key] = value
            client.credentials(HTTP_X_CSRFTOKEN=csrf)
            return client.post(
                ADDRESSES, {**PAYLOAD, "label": f"Home {index}"}, format="json"
            ).status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert list(executor.map(create, range(2))) == [201, 201]
    assert user.addresses.count() == 2
    assert user.addresses.filter(is_default=True).count() == 1
