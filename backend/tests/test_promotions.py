from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance
from apps.orders.services import preview
from apps.promotions.models import Promotion, PromotionVariant
from apps.promotions.services import get_active_promotions_for_variants
from apps.users.models import User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


def make_client(user):
    c = APIClient(enforce_csrf_checks=True)
    token = c.get("/api/v1/auth/csrf/").data["csrfToken"]
    c.credentials(HTTP_X_CSRFTOKEN=token)
    res = c.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    assert res.status_code == 200
    c.credentials(HTTP_X_CSRFTOKEN=res.data["csrfToken"])
    return c


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        "promo-admin@example.com", PASSWORD, name="Admin Promo", role="ADMIN"
    )


@pytest.fixture
def sample_catalog(db):
    cat = Category.objects.create(name="Periféricos", slug="perifericos")
    brand = Brand.objects.create(name="Logitech", slug="logitech")
    product = Product.objects.create(
        name="Mouse Gamer G502",
        slug="mouse-gamer-g502",
        description="Mouse de alta precisión",
        category=cat,
        brand=brand,
        is_active=True,
    )
    variant1 = Variant.objects.create(
        product=product,
        name="Negro",
        sku="G502-BLK",
        price=Decimal("150000.00"),
        is_active=True,
    )
    variant2 = Variant.objects.create(
        product=product,
        name="Blanco",
        sku="G502-WHT",
        price=Decimal("160000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=variant1).update(available_quantity=20)
    InventoryBalance.objects.filter(variant=variant2).update(available_quantity=15)
    return product, variant1, variant2


def test_promotions_admin_permission_required(user, admin_user):
    anon = APIClient()
    # Anonymous client
    res = anon.get("/api/v1/admin/promotions/")
    assert res.status_code == 401

    # Client user (not ADMIN)
    client_c = make_client(user)
    res = client_c.get("/api/v1/admin/promotions/")
    assert res.status_code == 403

    # Admin user
    admin_c = make_client(admin_user)
    res = admin_c.get("/api/v1/admin/promotions/")
    assert res.status_code == 200


def test_create_promotion_success(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, v2 = sample_catalog
    now = timezone.now()
    payload = {
        "name": "Black Friday Gamer",
        "starts_at": (now - timedelta(days=1)).isoformat(),
        "ends_at": (now + timedelta(days=5)).isoformat(),
        "is_active": True,
        "prices": [
            {"variant": v1.pk, "price": "120000.00"},
            {"variant": v2.pk, "price": "130000.00"},
        ],
    }
    res = admin_c.post("/api/v1/admin/promotions/", payload, format="json")
    assert res.status_code == 201
    data = res.data
    assert data["name"] == "Black Friday Gamer"
    assert data["is_active"] is True
    assert len(data["prices"]) == 2
    assert Promotion.objects.count() == 1
    assert PromotionVariant.objects.count() == 2


def test_create_promotion_rejects_invalid_dates(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, _ = sample_catalog
    now = timezone.now()
    # ends_at before starts_at
    payload = {
        "name": "Promo Inválida",
        "starts_at": (now + timedelta(days=2)).isoformat(),
        "ends_at": (now + timedelta(days=1)).isoformat(),
        "is_active": True,
        "prices": [{"variant": v1.pk, "price": "100000.00"}],
    }
    res = admin_c.post("/api/v1/admin/promotions/", payload, format="json")
    assert res.status_code == 400
    assert "ends_at" in res.data.get("details", res.data)


def test_create_promotion_rejects_price_greater_or_equal_to_base(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, _ = sample_catalog
    now = timezone.now()
    # v1 base price is 150000.00; offer is 150000.00 or higher
    payload = {
        "name": "Sin Descuento",
        "starts_at": now.isoformat(),
        "ends_at": (now + timedelta(days=2)).isoformat(),
        "is_active": True,
        "prices": [{"variant": v1.pk, "price": "150000.00"}],
    }
    res = admin_c.post("/api/v1/admin/promotions/", payload, format="json")
    assert res.status_code == 400
    assert "prices" in res.data.get("details", res.data)


def test_create_promotion_rejects_duplicate_variant_in_same_promotion(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, _ = sample_catalog
    now = timezone.now()
    payload = {
        "name": "Duplicado",
        "starts_at": now.isoformat(),
        "ends_at": (now + timedelta(days=2)).isoformat(),
        "is_active": True,
        "prices": [
            {"variant": v1.pk, "price": "100000.00"},
            {"variant": v1.pk, "price": "90000.00"},
        ],
    }
    res = admin_c.post("/api/v1/admin/promotions/", payload, format="json")
    assert res.status_code == 400
    assert "prices" in res.data.get("details", res.data)


def test_reject_overlapping_active_promotions_for_same_variant(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, _ = sample_catalog
    now = timezone.now()
    # Create first active promotion
    promo1 = Promotion.objects.create(
        name="Promo 1",
        starts_at=now,
        ends_at=now + timedelta(days=10),
        is_active=True,
    )
    PromotionVariant.objects.create(promotion=promo1, variant=v1, price=Decimal("110000.00"))

    # Try creating second overlapping active promotion for same variant
    payload = {
        "name": "Promo 2 Solapada",
        "starts_at": (now + timedelta(days=2)).isoformat(),
        "ends_at": (now + timedelta(days=12)).isoformat(),
        "is_active": True,
        "prices": [{"variant": v1.pk, "price": "100000.00"}],
    }
    res = admin_c.post("/api/v1/admin/promotions/", payload, format="json")
    assert res.status_code == 400
    assert "non_field_errors" in res.data.get("details", res.data)

    # But if promo 2 is inactive, it should be allowed
    payload["is_active"] = False
    res2 = admin_c.post("/api/v1/admin/promotions/", payload, format="json")
    assert res2.status_code == 201


def test_update_promotion_and_replace_prices(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, v2 = sample_catalog
    now = timezone.now()
    promo = Promotion.objects.create(
        name="Promo Original",
        starts_at=now,
        ends_at=now + timedelta(days=5),
        is_active=False,
    )
    PromotionVariant.objects.create(promotion=promo, variant=v1, price=Decimal("120000.00"))

    patch_payload = {
        "name": "Promo Actualizada",
        "is_active": True,
        "prices": [
            {"variant": v2.pk, "price": "140000.00"},
        ],
    }
    res = admin_c.patch(f"/api/v1/admin/promotions/{promo.pk}/", patch_payload, format="json")
    assert res.status_code == 200
    assert res.data["name"] == "Promo Actualizada"
    assert res.data["is_active"] is True
    promo.refresh_from_db()
    assert promo.prices.count() == 1
    assert promo.prices.first().variant_id == v2.pk


def test_delete_promotion(admin_user, sample_catalog):
    admin_c = make_client(admin_user)
    _, v1, _ = sample_catalog
    now = timezone.now()
    promo = Promotion.objects.create(
        name="Para Borrar",
        starts_at=now,
        ends_at=now + timedelta(days=3),
        is_active=False,
    )
    PromotionVariant.objects.create(promotion=promo, variant=v1, price=Decimal("100000.00"))

    res = admin_c.delete(f"/api/v1/admin/promotions/{promo.pk}/")
    assert res.status_code == 204
    assert not Promotion.objects.filter(pk=promo.pk).exists()
    assert not PromotionVariant.objects.filter(promotion_id=promo.pk).exists()


def test_service_get_active_promotions_for_variants(sample_catalog):
    _, v1, v2 = sample_catalog
    now = timezone.now()
    # Active promo for v1
    promo_active = Promotion.objects.create(
        name="Activa",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=5),
        is_active=True,
    )
    PromotionVariant.objects.create(promotion=promo_active, variant=v1, price=Decimal("110000.00"))

    # Inactive promo for v2
    promo_inactive = Promotion.objects.create(
        name="Inactiva",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=5),
        is_active=False,
    )
    PromotionVariant.objects.create(
        promotion=promo_inactive, variant=v2, price=Decimal("120000.00")
    )

    offers = get_active_promotions_for_variants([v1.pk, v2.pk], now=now)
    assert v1.pk in offers
    assert offers[v1.pk]["promotion_name"] == "Activa"
    assert offers[v1.pk]["promotional_price"] == Decimal("110000.00")
    assert v2.pk not in offers


def test_promotion_applied_in_checkout_preview(user, sample_catalog):
    _, v1, _ = sample_catalog
    now = timezone.now()

    # Configure required store settings for preview
    for key, val in {
        "unpaid_order_timeout_hours": 12,
        "urban_flat_shipping_rate": 5000,
        "free_shipping_threshold": 200000,
        "anonymous_cart_ttl_days": 14,
    }.items():
        StoreSetting.objects.update_or_create(key=key, defaults={"value": val})

    # Active promo
    promo = Promotion.objects.create(
        name="Super Oferta",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=5),
        is_active=True,
    )
    PromotionVariant.objects.create(promotion=promo, variant=v1, price=Decimal("120000.00"))

    data = {
        "items": [{"variant_id": v1.pk, "quantity": 1}],
        "delivery_mode": "PICKUP",
    }
    q = preview(user, data)
    assert q["discount"] == "30000.00"  # 150000 - 120000
    assert q["items"][0]["discount"] == "30000.00"
    assert q["items"][0]["total"] == "120000.00"
    assert q["items"][0]["promotion"]["name"] == "Super Oferta"
