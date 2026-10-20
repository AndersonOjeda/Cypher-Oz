from decimal import Decimal
import pytest
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance
from apps.orders.models import Order
from apps.users.models import User


@pytest.fixture
def test_setup(db):
    admin = User.objects.create_superuser(
        email="admin_sprint4@test.com", password="Password123!", name="Admin Sprint 4"
    )
    client_user = User.objects.create_user(
        email="cliente1@test.com", password="Password123!", name="Cliente Uno"
    )
    client_user_2 = User.objects.create_user(
        email="cliente2@test.com", password="Password123!", name="Maria Perez"
    )

    cat = Category.objects.create(name="Audio", slug="audio", is_active=True)
    brand = Brand.objects.create(name="Sony", slug="sony", is_active=True)
    prod = Product.objects.create(
        name="Audifonos WH-1000XM5",
        slug="audifonos-wh1000xm5",
        category=cat,
        brand=brand,
        is_active=True,
    )
    var1 = Variant.objects.create(
        product=prod, name="Negro", sku="SNY-XM5-BLK", price=Decimal("150000.00"), is_active=True
    )
    var2_inactive = Variant.objects.create(
        product=prod, name="Plateado", sku="SNY-XM5-SLV", price=Decimal("150000.00"), is_active=False
    )
    InventoryBalance.objects.filter(variant=var1).update(available_quantity=10)

    # Create an order for client_user
    Order.objects.create(
        user=client_user,
        idempotency_key="key-sprint-4-1",
        request_hash="hash-1",
        subtotal=Decimal("150000.00"),
        discount=Decimal("0.00"),
        shipping=Decimal("0.00"),
        total=Decimal("150000.00"),
        status="PENDING",
    )

    StoreSetting.objects.update_or_create(key="urban_flat_shipping_rate", defaults={"value": 5000})
    StoreSetting.objects.update_or_create(key="free_shipping_threshold", defaults={"value": 100000})

    return {
        "admin": admin,
        "client": client_user,
        "client_2": client_user_2,
        "variant": var1,
        "variant_inactive": var2_inactive,
    }


# ==================== CO-62: Admin Customer Listing ====================

def test_admin_customer_list_requires_admin(test_setup):
    anon = APIClient()
    res = anon.get("/api/v1/admin/customers/")
    assert res.status_code == 401

    client_cli = APIClient()
    client_cli.force_authenticate(user=test_setup["client"])
    res = client_cli.get("/api/v1/admin/customers/")
    assert res.status_code == 403

    admin_cli = APIClient()
    admin_cli.force_authenticate(user=test_setup["admin"])
    res = admin_cli.get("/api/v1/admin/customers/")
    assert res.status_code == 200
    assert len(res.data) >= 2
    # Ensure no sensitive fields
    first = res.data[0]
    assert "password" not in first
    assert "token" not in first
    assert "id" in first
    assert "email" in first
    assert "name" in first
    assert "order_count" in first


def test_admin_customer_list_order_count_and_filter(test_setup):
    admin_cli = APIClient()
    admin_cli.force_authenticate(user=test_setup["admin"])

    # All customers
    res = admin_cli.get("/api/v1/admin/customers/")
    assert res.status_code == 200
    c1 = next(c for c in res.data if c["email"] == "cliente1@test.com")
    assert c1["order_count"] == 1
    c2 = next(c for c in res.data if c["email"] == "cliente2@test.com")
    assert c2["order_count"] == 0

    # Search filter by name
    res_search = admin_cli.get("/api/v1/admin/customers/?q=Maria")
    assert res_search.status_code == 200
    assert len(res_search.data) == 1
    assert res_search.data[0]["name"] == "Maria Perez"

    # Search filter by email
    res_search_email = admin_cli.get("/api/v1/admin/customers/?q=cliente1")
    assert res_search_email.status_code == 200
    assert len(res_search_email.data) == 1
    assert res_search_email.data[0]["email"] == "cliente1@test.com"


# ==================== CO-57: Cart Revalidation ====================

def test_cart_validate_ok(test_setup):
    cli = APIClient()
    var = test_setup["variant"]
    payload = {
        "items": [
            {"variant_id": var.id, "quantity": 2, "unit_price": "150000.00"}
        ]
    }
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is False
    assert len(res.data["items"]) == 1
    assert res.data["items"][0]["status"] == "ok"
    assert res.data["items"][0]["available_qty"] == 10


def test_cart_validate_inactive_variant(test_setup):
    cli = APIClient()
    inactive_var = test_setup["variant_inactive"]
    payload = {
        "items": [
            {"variant_id": inactive_var.id, "quantity": 1, "unit_price": "150000.00"}
        ]
    }
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["status"] == "inactive"


def test_cart_validate_price_changed(test_setup):
    cli = APIClient()
    var = test_setup["variant"]
    # Client thinks it was 120000, but authoritative price is 150000
    payload = {
        "items": [
            {"variant_id": var.id, "quantity": 1, "unit_price": "120000.00"}
        ]
    }
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["status"] == "price_changed"
    assert res.data["items"][0]["current_price"] == "150000.00"


def test_cart_validate_insufficient_stock(test_setup):
    cli = APIClient()
    var = test_setup["variant"]
    # Available is 10, request 20
    payload = {
        "items": [
            {"variant_id": var.id, "quantity": 20, "unit_price": "150000.00"}
        ]
    }
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["status"] == "insufficient_stock"
    assert res.data["items"][0]["available_qty"] == 10


# ==================== CO-70: Delivery Quote & Settings ====================

def test_delivery_quote_pickup(test_setup):
    cli = APIClient()
    res = cli.post("/api/v1/delivery/quote/", {"mode": "PICKUP", "subtotal": 50000}, format="json")
    assert res.status_code == 200
    assert res.data["mode"] == "PICKUP"
    assert res.data["cost"] == "0.00"
    assert res.data["can_confirm"] is True


def test_delivery_quote_special(test_setup):
    cli = APIClient()
    res = cli.post("/api/v1/delivery/quote/", {"mode": "SPECIAL", "subtotal": 50000}, format="json")
    assert res.status_code == 200
    assert res.data["mode"] == "SPECIAL"
    assert res.data["cost"] is None
    assert res.data["can_confirm"] is False
    assert "Tarifa especial" in res.data["message"]


def test_delivery_quote_urban_below_and_above_threshold(test_setup):
    cli = APIClient()
    # Below threshold ($50.000 < $100.000) -> $5.000 shipping
    res_below = cli.post("/api/v1/delivery/quote/", {"mode": "URBAN", "subtotal": 50000}, format="json")
    assert res_below.status_code == 200
    assert res_below.data["cost"] == "5000.00"
    assert res_below.data["is_free"] is False
    assert res_below.data["can_confirm"] is True

    # At or above threshold ($100.000 >= $100.000) -> Free shipping ($0.00)
    res_above = cli.post("/api/v1/delivery/quote/", {"mode": "URBAN", "subtotal": 100000}, format="json")
    assert res_above.status_code == 200
    assert res_above.data["cost"] == "0.00"
    assert res_above.data["is_free"] is True
    assert res_above.data["can_confirm"] is True


def test_admin_delivery_settings_get_and_patch(test_setup):
    admin_cli = APIClient()
    admin_cli.force_authenticate(user=test_setup["admin"])

    # GET
    res_get = admin_cli.get("/api/v1/admin/delivery/settings/")
    assert res_get.status_code == 200
    assert res_get.data["urban_flat_shipping_rate"] == 5000
    assert res_get.data["free_shipping_threshold"] == 100000

    # PATCH
    res_patch = admin_cli.patch(
        "/api/v1/admin/delivery/settings/",
        {"urban_flat_shipping_rate": 6000, "free_shipping_threshold": 120000},
        format="json",
    )
    assert res_patch.status_code == 200
    assert res_patch.data["urban_flat_shipping_rate"] == 6000
    assert res_patch.data["free_shipping_threshold"] == 120000

    # Non-admin rejected
    client_cli = APIClient()
    client_cli.force_authenticate(user=test_setup["client"])
    res_client = client_cli.get("/api/v1/admin/delivery/settings/")
    assert res_client.status_code == 403
