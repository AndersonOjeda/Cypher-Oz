from unittest.mock import patch

import pytest
from django.db.utils import OperationalError

from apps.configuration.models import SettingChange, StoreSetting

pytestmark = pytest.mark.django_db


def test_health_queries_postgres(client):
    r = client.get("/health/")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "postgresql"}


def test_health_failure_is_controlled(client):
    with patch("apps.core.views.connection.cursor", side_effect=OperationalError):
        r = client.get("/health/")
    assert r.status_code == 503
    assert r.json()["database"] == "unavailable"


def test_public_settings_are_minimal(client):
    r = client.get("/api/v1/settings/public/")
    assert r.status_code == 200
    assert set(r.data) == {"whatsapp_enabled", "whatsapp_number", "whatsapp_message"}


def test_public_commercial_info_uses_json_boolean_and_live_delivery_settings(client):
    StoreSetting.objects.update_or_create(key="whatsapp_enabled", defaults={"value": False})
    StoreSetting.objects.update_or_create(key="urban_flat_shipping_rate", defaults={"value": 7200})
    StoreSetting.objects.update_or_create(key="free_shipping_threshold", defaults={"value": 125000})
    response = client.get("/api/v1/settings/commercial/")
    assert response.status_code == 200
    assert response.data["contact"]["configured"] is False
    assert response.data["contact"]["whatsapp_enabled"] is False
    urban = next(item for item in response.data["delivery"]["modes"] if item["mode"] == "URBAN")
    assert urban["cost"] == "7200.00"
    assert urban["free_shipping_threshold"] == "125000.00"


def test_public_commercial_info_never_treats_false_string_as_true(client):
    StoreSetting.objects.update_or_create(key="whatsapp_enabled", defaults={"value": "false"})
    StoreSetting.objects.update_or_create(key="whatsapp_number", defaults={"value": "573001234567"})
    response = client.get("/api/v1/settings/commercial/")
    assert response.data["contact"]["configured"] is False


def test_settings_update_is_immediate(logged_in, user):
    user.role = "ADMIN"
    user.save()
    r = logged_in.patch(
        "/api/v1/admin/settings/",
        {
            "whatsapp_enabled": True,
            "whatsapp_number": "12025550123",
            "whatsapp_message": "Hola & gracias",
        },
        format="json",
    )
    assert r.status_code == 200
    assert logged_in.get("/api/v1/settings/public/").data["whatsapp_number"] == "12025550123"
    assert SettingChange.objects.filter(actor=user).count() == 3


def test_client_cannot_change_settings(logged_in):
    assert (
        logged_in.patch(
            "/api/v1/admin/settings/", {"whatsapp_enabled": True}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "change",
    [
        {"whatsapp_enabled": True, "whatsapp_number": "abc"},
        {"urban_flat_shipping_rate": -1},
        {"unknown": True},
    ],
)
def test_invalid_settings_do_not_persist(logged_in, user, change):
    user.role = "ADMIN"
    user.save()
    before = dict(StoreSetting.objects.values_list("key", "value"))
    assert logged_in.patch("/api/v1/admin/settings/", change, format="json").status_code == 400
    assert dict(StoreSetting.objects.values_list("key", "value")) == before
