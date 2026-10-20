from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance
from apps.orders.models import Order
from apps.promotions.models import Promotion, PromotionVariant
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
        product=prod,
        name="Plateado",
        sku="SNY-XM5-SLV",
        price=Decimal("150000.00"),
        is_active=False,
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
    assert res.data["count"] >= 2
    # Ensure no sensitive fields
    first = res.data["results"][0]
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
    c1 = next(c for c in res.data["results"] if c["email"] == "cliente1@test.com")
    assert c1["order_count"] == 1
    c2 = next(c for c in res.data["results"] if c["email"] == "cliente2@test.com")
    assert c2["order_count"] == 0

    # Search filter by name
    res_search = admin_cli.get("/api/v1/admin/customers/?q=Maria")
    assert res_search.status_code == 200
    assert res_search.data["count"] == 1
    assert res_search.data["results"][0]["name"] == "Maria Perez"

    # Search filter by email
    res_search_email = admin_cli.get("/api/v1/admin/customers/?q=cliente1")
    assert res_search_email.status_code == 200
    assert res_search_email.data["count"] == 1
    assert res_search_email.data["results"][0]["email"] == "cliente1@test.com"


def test_customer_pagination_is_bounded_and_stable(test_setup):
    User.objects.bulk_create(
        [
            User(
                email=f"volume-{index}@example.com", name=f"Customer {index}", role=User.Role.CLIENT
            )
            for index in range(25)
        ]
    )
    cli = APIClient()
    cli.force_authenticate(user=test_setup["admin"])
    first = cli.get("/api/v1/admin/customers/")
    second = cli.get("/api/v1/admin/customers/?page=2")
    assert first.data["count"] == 27
    assert len(first.data["results"]) == 20
    assert len(second.data["results"]) == 7
    assert first.data["next"] and second.data["previous"]
    assert not (
        {u["id"] for u in first.data["results"]} & {u["id"] for u in second.data["results"]}
    )
    assert first["Cache-Control"] == "no-store"
    empty = cli.get("/api/v1/admin/customers/?q=does-not-exist")
    assert empty.data["results"] == []


def test_cart_promotion_expiry_and_validation_never_mutates_stock(test_setup):
    variant = test_setup["variant"]
    now = timezone.now()
    promotion = Promotion.objects.create(
        name="Cart regression",
        starts_at=now - timedelta(days=1),
        ends_at=now + timedelta(days=1),
        is_active=True,
    )
    offer = PromotionVariant.objects.create(promotion=promotion, variant=variant, price="100000.00")
    cli = APIClient()
    payload = {"items": [{"variant_id": variant.pk, "quantity": 1, "unit_price": "100000.00"}]}
    assert (
        cli.post("/api/v1/checkout/validate/", payload, format="json").data["items"][0]["status"]
        == "ok"
    )
    promotion.ends_at = now - timedelta(seconds=1)
    promotion.save()
    result = cli.post("/api/v1/checkout/validate/", payload, format="json").data["items"][0]
    assert result["status"] == "price_changed"
    assert result["current_price"] == "150000.00"
    promotion.ends_at = now + timedelta(days=1)
    promotion.save()
    offer.price = "160000.00"
    offer.save()
    result = cli.post("/api/v1/checkout/validate/", payload, format="json").data["items"][0]
    assert result["current_price"] == "150000.00"
    assert InventoryBalance.objects.get(variant=variant).available_quantity == 10
    assert Order.objects.count() == 1


# ==================== CO-57: Cart Revalidation ====================


def test_cart_validate_ok(test_setup):
    cli = APIClient()
    var = test_setup["variant"]
    payload = {"items": [{"variant_id": var.id, "quantity": 2, "unit_price": "150000.00"}]}
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is False
    assert len(res.data["items"]) == 1
    assert res.data["items"][0]["status"] == "ok"
    assert res.data["items"][0]["available_qty"] == 10


def test_cart_validate_inactive_variant(test_setup):
    cli = APIClient()
    inactive_var = test_setup["variant_inactive"]
    payload = {"items": [{"variant_id": inactive_var.id, "quantity": 1, "unit_price": "150000.00"}]}
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["status"] == "inactive"


def test_cart_validate_price_changed(test_setup):
    cli = APIClient()
    var = test_setup["variant"]
    # Client thinks it was 120000, but authoritative price is 150000
    payload = {"items": [{"variant_id": var.id, "quantity": 1, "unit_price": "120000.00"}]}
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["status"] == "price_changed"
    assert res.data["items"][0]["current_price"] == "150000.00"


def test_cart_validate_insufficient_stock(test_setup):
    cli = APIClient()
    var = test_setup["variant"]
    # Available is 10, request 20
    payload = {"items": [{"variant_id": var.id, "quantity": 20, "unit_price": "150000.00"}]}
    res = cli.post("/api/v1/checkout/validate/", payload, format="json")
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["status"] == "insufficient_stock"
    assert res.data["items"][0]["available_qty"] == 10


# ==================== CO-70: Delivery Quote & Settings ====================


@pytest.mark.parametrize("quantity", [None, "two", -1, 0, 10001, True])
def test_cart_rejects_invalid_quantities(test_setup, quantity):
    response = APIClient().post(
        "/api/v1/checkout/validate/",
        {"items": [{"variant_id": test_setup["variant"].pk, "quantity": quantity}]},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.parametrize("price", ["NaN", "Infinity", "-1", "abc"])
def test_cart_rejects_invalid_prices(test_setup, price):
    response = APIClient().post(
        "/api/v1/checkout/validate/",
        {"items": [{"variant_id": test_setup["variant"].pk, "quantity": 1, "unit_price": price}]},
        format="json",
    )
    assert response.status_code == 400


def test_cart_rejects_duplicate_and_oversized_payloads(test_setup):
    line = {"variant_id": test_setup["variant"].pk, "quantity": 1}
    for items in [[line, line], [line] * 101, [None]]:
        response = APIClient().post("/api/v1/checkout/validate/", {"items": items}, format="json")
        assert response.status_code == 400


@pytest.mark.parametrize("relation", ["brand", "category"])
def test_cart_hides_disabled_taxonomy(test_setup, relation):
    entity = getattr(test_setup["variant"].product, relation)
    entity.is_active = False
    entity.save(update_fields=["is_active"])
    response = APIClient().post(
        "/api/v1/checkout/validate/",
        {"items": [{"variant_id": test_setup["variant"].pk, "quantity": 1}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["items"][0]["status"] == "inactive"


def test_cart_validation_query_count_does_not_grow_per_line(test_setup, django_assert_num_queries):
    variants = [test_setup["variant"]]
    for index in range(10):
        variants.append(
            Variant.objects.create(
                product=variants[0].product,
                name=f"Volume {index}",
                sku=f"VOLUME-{index}",
                price=Decimal("100.00"),
                is_active=True,
            )
        )
    items = [{"variant_id": variant.pk, "quantity": 1} for variant in variants]
    with django_assert_num_queries(3):
        response = APIClient().post("/api/v1/checkout/validate/", {"items": items}, format="json")
    assert response.status_code == 200
    assert len(response.data["items"]) == 11


@pytest.mark.parametrize("subtotal", ["NaN", "Infinity", "abc", -1, None])
def test_delivery_rejects_invalid_subtotal(db, subtotal):
    response = APIClient().post(
        "/api/v1/delivery/quote/", {"mode": "URBAN", "subtotal": subtotal}, format="json"
    )
    assert response.status_code == 400


def test_delivery_settings_invalid_patch_is_atomic(test_setup):
    cli = APIClient()
    cli.force_authenticate(user=test_setup["admin"])
    response = cli.patch(
        "/api/v1/admin/delivery/settings/",
        {"urban_flat_shipping_rate": 8000, "free_shipping_threshold": "abc"},
        format="json",
    )
    assert response.status_code == 400
    assert StoreSetting.objects.get(key="urban_flat_shipping_rate").value == 5000


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
    res_below = cli.post(
        "/api/v1/delivery/quote/", {"mode": "URBAN", "subtotal": 50000}, format="json"
    )
    assert res_below.status_code == 200
    assert res_below.data["cost"] == "5000.00"
    assert res_below.data["is_free"] is False
    assert res_below.data["can_confirm"] is True

    # At or above threshold ($100.000 >= $100.000) -> Free shipping ($0.00)
    res_above = cli.post(
        "/api/v1/delivery/quote/", {"mode": "URBAN", "subtotal": 100000}, format="json"
    )
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
