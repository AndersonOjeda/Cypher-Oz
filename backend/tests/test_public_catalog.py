from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import (
    Brand,
    Category,
    CategoryAttribute,
    Product,
    ProductImage,
    Variant,
    VariantAttributeValue,
)
from apps.inventory.models import InventoryBalance
from apps.promotions.models import Promotion, PromotionVariant

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog_setup(db):
    cat_perifericos = Category.objects.create(
        name="Periféricos", slug="perifericos", is_active=True
    )
    cat_inactiva = Category.objects.create(name="Inactiva", slug="inactiva", is_active=False)

    brand_logitech = Brand.objects.create(name="Logitech", slug="logitech", is_active=True)
    brand_corsair = Brand.objects.create(name="Corsair", slug="corsair", is_active=True)

    # Product 1: Active with 2 active variants and stock
    p1 = Product.objects.create(
        name="Mouse Gamer G502",
        slug="mouse-gamer-g502",
        description="Sensor óptico de alta precisión",
        warranty="1 año",
        category=cat_perifericos,
        brand=brand_logitech,
        is_active=True,
    )
    v1_1 = Variant.objects.create(
        product=p1,
        name="Negro",
        sku="G502-BLK",
        price=Decimal("150000.00"),
        is_active=True,
    )
    v1_2 = Variant.objects.create(
        product=p1,
        name="Blanco",
        sku="G502-WHT",
        price=Decimal("160000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v1_1).update(available_quantity=10)
    InventoryBalance.objects.filter(variant=v1_2).update(available_quantity=5)

    ProductImage.objects.create(
        product=p1,
        storage_key="products/1/main.webp",
        storage_url="http://storage.local/products/1/main.webp",
        alt_text="Mouse G502 vista frontal",
        sort_order=1,
        width=800,
        height=600,
        byte_size=50000,
    )

    # Product 2: Active keyboard with 0 stock (out of stock)
    p2 = Product.objects.create(
        name="Teclado Mecánico K55",
        slug="teclado-mecanico-k55",
        description="Teclado RGB",
        warranty="2 años",
        category=cat_perifericos,
        brand=brand_corsair,
        is_active=True,
    )
    v2_1 = Variant.objects.create(
        product=p2,
        name="RGB Español",
        sku="K55-RGB-ES",
        price=Decimal("200000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v2_1).update(available_quantity=0)

    # Product 3: Inactive product (should not appear in public catalog)
    p3 = Product.objects.create(
        name="Audífonos Ocultos",
        slug="audifonos-ocultos",
        description="No disponible",
        category=cat_perifericos,
        brand=brand_logitech,
        is_active=False,
    )
    v3_1 = Variant.objects.create(
        product=p3,
        name="Estándar",
        sku="AUD-001",
        price=Decimal("90000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v3_1).update(available_quantity=10)

    # Product 4: In inactive category (should not appear)
    p4 = Product.objects.create(
        name="Producto Categoría Inactiva",
        slug="producto-cat-inactiva",
        description="Cat inactiva",
        category=cat_inactiva,
        brand=brand_logitech,
        is_active=True,
    )
    v4_1 = Variant.objects.create(
        product=p4,
        name="Estándar",
        sku="INACT-001",
        price=Decimal("50000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=v4_1).update(available_quantity=10)

    return {
        "p1": p1,
        "v1_1": v1_1,
        "v1_2": v1_2,
        "p2": p2,
        "v2_1": v2_1,
        "cat_perifericos": cat_perifericos,
        "brand_logitech": brand_logitech,
        "brand_corsair": brand_corsair,
    }


def test_public_catalog_is_accessible_without_auth(catalog_setup):
    client = APIClient()
    res = client.get("/api/v1/products/")
    assert res.status_code == 200
    data = res.data
    assert "count" in data
    # Only p1 and p2 should appear; p3 (inactive) and p4 (inactive category) excluded
    assert data["count"] == 2
    slugs = [item["slug"] for item in data["results"]]
    assert "mouse-gamer-g502" in slugs
    assert "teclado-mecanico-k55" in slugs
    assert "audifonos-ocultos" not in slugs
    assert "producto-cat-inactiva" not in slugs


def test_public_catalog_includes_promotion_pricing(catalog_setup):
    data_setup = catalog_setup
    v1_1 = data_setup["v1_1"]
    now = timezone.now()

    # Active promotion on v1_1 (150000 -> 125000)
    promo = Promotion.objects.create(
        name="Oferta Flash",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=24),
        is_active=True,
    )
    PromotionVariant.objects.create(promotion=promo, variant=v1_1, price=Decimal("125000.00"))

    client = APIClient()
    res = client.get("/api/v1/products/")
    assert res.status_code == 200

    p1_data = next(x for x in res.data["results"] if x["slug"] == "mouse-gamer-g502")
    assert p1_data["has_promotion"] is True
    assert p1_data["min_price"] == "150000.00"
    assert p1_data["promotional_min_price"] == "125000.00"


def test_public_catalog_filter_by_search_and_taxonomy(catalog_setup):
    client = APIClient()

    # Search by keyword
    res = client.get("/api/v1/products/?search=mouse")
    assert res.status_code == 200
    assert res.data["count"] == 1
    assert res.data["results"][0]["slug"] == "mouse-gamer-g502"

    # Filter by category
    res_cat = client.get("/api/v1/products/?category=perifericos")
    assert res_cat.status_code == 200
    assert res_cat.data["count"] == 2

    # Filter by brand
    res_brand = client.get("/api/v1/products/?brand=corsair")
    assert res_brand.status_code == 200
    assert res_brand.data["count"] == 1
    assert res_brand.data["results"][0]["slug"] == "teclado-mecanico-k55"


def test_public_catalog_filter_by_price_and_availability(catalog_setup):
    client = APIClient()

    # Filter by min_price
    res = client.get("/api/v1/products/?min_price=180000")
    assert res.status_code == 200
    assert res.data["count"] == 1
    assert res.data["results"][0]["slug"] == "teclado-mecanico-k55"

    # Filter by availability (stock > 0): p1 has stock, p2 has 0 stock
    res_avail = client.get("/api/v1/products/?available=true")
    assert res_avail.status_code == 200
    assert res_avail.data["count"] == 1
    assert res_avail.data["results"][0]["slug"] == "mouse-gamer-g502"


def test_public_catalog_ordering(catalog_setup):
    client = APIClient()

    # Order by name A-Z
    res_asc = client.get("/api/v1/products/?ordering=name")
    assert res_asc.status_code == 200
    names = [x["name"] for x in res_asc.data["results"]]
    assert names == ["Mouse Gamer G502", "Teclado Mecánico K55"]

    # Order by name Z-A
    res_desc = client.get("/api/v1/products/?ordering=-name")
    assert res_desc.status_code == 200
    names_desc = [x["name"] for x in res_desc.data["results"]]
    assert names_desc == ["Teclado Mecánico K55", "Mouse Gamer G502"]


def test_public_product_detail_success_and_not_found(catalog_setup):
    client = APIClient()

    # Existing active product
    res = client.get("/api/v1/products/mouse-gamer-g502/")
    assert res.status_code == 200
    p = res.data
    assert p["name"] == "Mouse Gamer G502"
    assert p["warranty"] == "1 año"
    assert len(p["variants"]) == 2
    assert len(p["images"]) == 1
    assert p["images"][0]["alt_text"] == "Mouse G502 vista frontal"

    # Check variant data contains stock, sku, price
    var_black = next(v for v in p["variants"] if v["sku"] == "G502-BLK")
    assert var_black["stock"] == 10
    assert var_black["price"] == "150000.00"

    # Inactive product returns 404
    res_inactive = client.get("/api/v1/products/audifonos-ocultos/")
    assert res_inactive.status_code == 404

    # Nonexistent product returns 404
    res_missing = client.get("/api/v1/products/no-existe/")
    assert res_missing.status_code == 404


@pytest.mark.parametrize("ordering", ["price", "-price"])
def test_price_order_has_one_row_per_product_and_ignores_inactive_variants(catalog_setup, ordering):
    Variant.objects.create(
        product=catalog_setup["p2"],
        name="Oculta",
        sku="HIDDEN-PRICE",
        price=Decimal("1.00"),
        is_active=False,
    )
    response = APIClient().get(f"/api/v1/products/?ordering={ordering}&page_size=1")
    assert response.status_code == 200
    assert response.data["count"] == 2
    expected = ["mouse-gamer-g502", "teclado-mecanico-k55"]
    if ordering == "-price":
        expected.reverse()
    first = response.data["results"][0]["slug"]
    second = (
        APIClient()
        .get(f"/api/v1/products/?ordering={ordering}&page_size=1&page=2")
        .data["results"][0]["slug"]
    )
    assert [first, second] == expected


def test_price_bounds_must_match_the_same_active_variant(catalog_setup):
    # Neither variant costs 155000–158000, although one is above the minimum
    # and a different one is below the maximum.
    response = APIClient().get("/api/v1/products/?min_price=155000&max_price=158000")
    assert response.status_code == 200
    assert response.data["count"] == 0


@pytest.mark.parametrize("page_size", [1, 20])
def test_catalog_query_budget_does_not_grow_with_page_size(catalog_setup, page_size):
    for index in range(20):
        product = Product.objects.create(
            name=f"Equipo {index}",
            slug=f"equipo-{index}",
            description="Prueba de carga",
            category=catalog_setup["cat_perifericos"],
            brand=catalog_setup["brand_logitech"],
            is_active=True,
        )
        Variant.objects.create(product=product, sku=f"PERF-{index}", price="1000.00")
    with CaptureQueriesContext(connection) as queries:
        response = APIClient().get(f"/api/v1/products/?page_size={page_size}")
    assert response.status_code == 200
    assert len(response.data["results"]) == page_size
    assert len(queries) <= 5


def test_detail_preserves_variant_attributes_with_bounded_queries(catalog_setup):
    attribute = CategoryAttribute.objects.create(
        category=catalog_setup["cat_perifericos"],
        code="color",
        name="Color",
    )
    for key, value in [("v1_1", "Negro"), ("v1_2", "Blanco")]:
        VariantAttributeValue.objects.create(
            variant=catalog_setup[key],
            attribute=attribute,
            value=value,
        )
    with CaptureQueriesContext(connection) as queries:
        response = APIClient().get("/api/v1/products/mouse-gamer-g502/")
    assert response.status_code == 200
    variants = {v["sku"]: v for v in response.data["variants"]}
    assert variants["G502-BLK"]["attributes"] == [
        {"code": "color", "name": "Color", "value": "Negro"},
    ]
    assert variants["G502-WHT"]["attributes"][0]["value"] == "Blanco"
    assert len(queries) <= 5
