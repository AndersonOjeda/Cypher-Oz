from decimal import Decimal
from unittest.mock import patch

import pytest

from apps.catalog.models import Brand, Category, Product, Variant
from apps.inventory.models import InventoryBalance, StockMovement
from apps.users.models import User


@pytest.fixture
def inventory_data(db):
    category = Category.objects.create(name="Accesorios", slug="accesorios")
    brand = Brand.objects.create(name="TTI", slug="tti")
    product = Product.objects.create(
        name="Teclado",
        slug="teclado",
        description="Prueba",
        category=category,
        brand=brand,
        is_active=True,
    )
    return Variant.objects.create(product=product, sku="TEC-001", price=Decimal("100.00"))


@pytest.fixture
def admin_client(client):
    admin = User.objects.create_user(
        "admin@example.com", "Admin-clave!8472", name="Admin", role="ADMIN"
    )
    response = client.post(
        "/api/v1/auth/login/", {"email": admin.email, "password": "Admin-clave!8472"}, format="json"
    )
    client.credentials(HTTP_X_CSRFTOKEN=response.data["csrfToken"])
    return client


@pytest.mark.django_db
def test_entry_and_adjustment_create_audited_ledger(admin_client, inventory_data):
    entry = admin_client.post(
        "/api/v1/admin/inventory/entries/",
        {"variant": inventory_data.id, "quantity": 10, "reason": "Compra proveedor"},
        format="json",
    )
    assert entry.status_code == 201
    adjustment = admin_client.post(
        "/api/v1/admin/inventory/adjustments/",
        {"variant": inventory_data.id, "quantity": -3, "reason": "Conteo físico"},
        format="json",
    )
    assert adjustment.status_code == 201
    assert InventoryBalance.objects.get(variant=inventory_data).available_quantity == 7
    assert list(StockMovement.objects.values_list("type", "resulting_quantity")) == [
        ("ADJUSTMENT", 7),
        ("ENTRY", 10),
    ]


@pytest.mark.django_db
def test_adjustment_rejects_missing_reason_negative_stock_and_non_admin(
    admin_client, client, user, inventory_data
):
    assert (
        admin_client.post(
            "/api/v1/admin/inventory/adjustments/",
            {"variant": inventory_data.id, "quantity": 1, "reason": ""},
            format="json",
        ).status_code
        == 400
    )
    assert (
        admin_client.post(
            "/api/v1/admin/inventory/adjustments/",
            {"variant": inventory_data.id, "quantity": -1, "reason": "Conteo"},
            format="json",
        ).status_code
        == 409
    )
    assert not StockMovement.objects.exists()
    login = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": "Una-clave!Distinta8472"},
        format="json",
    )
    client.credentials(HTTP_X_CSRFTOKEN=login.data["csrfToken"])
    assert (
        client.post(
            "/api/v1/admin/inventory/entries/",
            {"variant": inventory_data.id, "quantity": 1, "reason": "No permitido"},
            format="json",
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_movement_filters_validate_dates(admin_client, inventory_data):
    admin_client.post(
        "/api/v1/admin/inventory/entries/",
        {"variant": inventory_data.id, "quantity": 2, "reason": "Inicial"},
        format="json",
    )
    result = admin_client.get(
        f"/api/v1/admin/inventory/movements/?variant={inventory_data.id}&type=ENTRY&from=2020-01-01&to=2099-12-31"
    )
    assert result.status_code == 200 and result.data["count"] == 1
    assert result.data["results"][0]["actor_name"] == "Admin"
    assert admin_client.get("/api/v1/admin/inventory/movements/?from=13-10-2026").status_code == 400


@pytest.mark.django_db
def test_movement_rolls_back_balance_when_ledger_write_fails(admin_client, inventory_data):
    with patch(
        "apps.inventory.services.StockMovement.objects.create",
        side_effect=RuntimeError("ledger unavailable"),
    ):
        with pytest.raises(RuntimeError, match="ledger unavailable"):
            admin_client.post(
                "/api/v1/admin/inventory/entries/",
                {"variant": inventory_data.id, "quantity": 5, "reason": "Prueba rollback"},
                format="json",
            )
    assert InventoryBalance.objects.get(variant=inventory_data).available_quantity == 0
    assert not StockMovement.objects.exists()
