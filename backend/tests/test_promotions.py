from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, CatalogChange, Category, Product, Variant
from apps.promotions.models import Promotion, PromotionVariant

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(logged_in, user):
    user.role = "ADMIN"
    user.save()
    return logged_in


@pytest.fixture
def variant():
    category = Category.objects.create(name="Portátiles", slug="portatiles")
    brand = Brand.objects.create(name="Marca", slug="marca")
    product = Product.objects.create(
        name="Equipo",
        slug="equipo",
        description="Equipo de prueba",
        category=category,
        brand=brand,
        is_active=True,
    )
    return Variant.objects.create(product=product, name="Base", sku="PROMO-1", price="100.00")


def payload(variant, **changes):
    now = timezone.now()
    data = {
        "name": "Oferta vigente",
        "starts_at": (now - timedelta(hours=1)).isoformat(),
        "ends_at": (now + timedelta(days=1)).isoformat(),
        "is_active": True,
        "prices": [{"variant": variant.pk, "price": "80.00"}],
    }
    data.update(changes)
    return data


def test_promotions_require_admin(client, logged_in):
    visitor = APIClient()
    assert visitor.get("/api/v1/admin/promotions/").status_code == 401
    assert logged_in.get("/api/v1/admin/promotions/").status_code == 403


def test_promotion_crud_filter_and_audit(admin, variant):
    url = "/api/v1/admin/promotions/"
    created = admin.post(url, payload(variant), format="json")
    assert created.status_code == 201
    identity = created.data["id"]
    assert created.data["prices"] == [{"variant": variant.pk, "price": "80.00"}]
    assert admin.get(url + "?state=current").data["count"] == 1
    changed = admin.patch(
        f"{url}{identity}/",
        {"name": "Oferta corregida", "prices": [{"variant": variant.pk, "price": "75.00"}]},
        format="json",
    )
    assert changed.status_code == 200
    assert PromotionVariant.objects.get().price == 75
    assert admin.delete(f"{url}{identity}/").status_code == 409
    assert admin.patch(f"{url}{identity}/", {"is_active": False}, format="json").status_code == 200
    assert admin.delete(f"{url}{identity}/").status_code == 204
    assert list(CatalogChange.objects.values_list("action", flat=True)) == [
        "create",
        "update",
        "update",
        "delete",
    ]


def test_rejects_dates_duplicates_unknown_fields_and_overlap(admin, variant):
    url = "/api/v1/admin/promotions/"
    assert admin.post(url, payload(variant), format="json").status_code == 201
    bad_dates = payload(
        variant,
        starts_at=timezone.now().isoformat(),
        ends_at=timezone.now().isoformat(),
    )
    assert admin.post(url, bad_dates, format="json").status_code == 400
    duplicate = payload(
        variant,
        name="Duplicada",
        prices=[
            {"variant": variant.pk, "price": "70.00"},
            {"variant": variant.pk, "price": "60.00"},
        ],
    )
    assert admin.post(url, duplicate, format="json").status_code == 400
    assert admin.post(url, payload(variant, role="ADMIN"), format="json").status_code == 400
    assert admin.post(url, payload(variant, name="Solapada"), format="json").status_code == 400
    assert Promotion.objects.count() == 1
