from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch

import pytest
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.db.models.deletion import ProtectedError
from rest_framework.test import APIClient

from apps.catalog.models import (
    Brand,
    CatalogChange,
    Category,
    CategoryAttribute,
    Product,
    Variant,
    VariantAttributeValue,
)
from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(logged_in, user):
    user.role = "ADMIN"
    user.save()
    return logged_in


@pytest.fixture
def product():
    return Product.objects.create(
        name="Teclado",
        slug="teclado",
        description="Teclado USB",
        is_active=True,
        category=Category.objects.create(name="Teclados", slug="teclados"),
        brand=Brand.objects.create(name="Marca TTI", slug="marca-tti"),
    )


@pytest.fixture
def attribute(product):
    return CategoryAttribute.objects.create(category=product.category, code="color", name="Color")


@pytest.fixture
def variant(product):
    return Variant.objects.create(product=product, sku="TTI-001", price=Decimal("1250.50"))


def variant_url(product):
    return f"/api/v1/admin/products/{product.pk}/variants/"


def detail_url(variant):
    return f"/api/v1/admin/variants/{variant.pk}/"


def attributes_url(product):
    return f"/api/v1/admin/categories/{product.category_id}/attributes/"


def test_admin_standard_variant_normalization_persistence_and_audit(admin, product):
    assert not product.variants.exists()
    result = admin.post(variant_url(product), {"sku": "  tti-001  ", "price": "0"}, format="json")
    assert result.status_code == 201
    assert result.data["name"] == "Estándar"
    assert result.data["sku"] == "TTI-001"
    assert result.data["price"] == "0.00"
    assert result.data["attributes"] == []
    assert result.data["is_active"] is True
    assert result.data["catalog_available"] is True
    saved = Variant.objects.get(pk=result.data["id"])
    assert saved.product_id == product.pk
    assert saved.price == Decimal("0.00")
    assert admin.get(detail_url(saved)).data == result.data
    listing = admin.get(variant_url(product))
    assert listing["Cache-Control"] == "no-store"
    assert listing.data["count"] == 1
    assert listing.data["results"][0] == result.data
    changes = CatalogChange.objects.get(entity="variant").changes
    assert changes["price"] == {"before": None, "after": "0.00"}


def test_variant_edit_retains_identity_and_attributes_and_records_decimal_audit(
    admin, product, variant, attribute
):
    VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value="Azul")
    result = admin.patch(
        detail_url(variant),
        {"price": "9999999999.99", "name": "Azul", "is_active": False},
        format="json",
    )
    assert result.status_code == 200
    assert result.data["price"] == "9999999999.99"
    assert result.data["id"] == variant.pk
    assert result.data["sku"] == "TTI-001"
    assert result.data["attributes"] == [
        {"attribute": attribute.pk, "code": "color", "name": "Color", "value": "Azul"}
    ]
    assert result.data["catalog_available"] is False
    assert admin.get(detail_url(variant)).data == result.data
    changes = CatalogChange.objects.get(entity="variant").changes
    assert changes["price"] == {"before": "1250.50", "after": "9999999999.99"}
    assert changes["is_active"] == {"before": True, "after": False}
    assert Variant.objects.count() == 1
    assert admin.delete(detail_url(variant)).status_code == 405


@pytest.mark.parametrize(
    "payload",
    [
        {"price": "-0.01"},
        {"price": "1.001"},
        {"price": "10000000000.00"},
        {"price": "NaN"},
        {"price": "Infinity"},
        {"price": "-Infinity"},
        {"price": None},
        {"price": ""},
        {"price": True},
        {"price": []},
        {"price": "1,20"},
        {"sku": " "},
        {"sku": 42},
        {"name": 12},
        {"name": " "},
        {"sku": "S" * 81},
        {"is_active": "false"},
        {"product": 9999},
        {"stock": 4},
        {"attributes": None},
        {"attributes": {}},
    ],
)
def test_invalid_variant_payload_leaves_database_unchanged(admin, variant, payload):
    assert admin.patch(detail_url(variant), payload, format="json").status_code == 400
    variant.refresh_from_db()
    assert variant.price == Decimal("1250.50")
    assert variant.sku == "TTI-001" and variant.name == "Estándar" and variant.is_active
    assert not CatalogChange.objects.exists()


@pytest.mark.parametrize("payload", [{"sku": "NO-PRICE"}, {"price": "10.00"}, {}])
def test_sku_and_price_are_required_without_generated_business_data(admin, product, payload):
    assert admin.post(variant_url(product), payload, format="json").status_code == 400
    assert not Variant.objects.exists()


def test_sku_unique_across_products_and_case(admin, product, variant):
    other = Product.objects.create(
        name="Otro", slug="otro", category=product.category, brand=product.brand
    )
    result = admin.post(variant_url(other), {"sku": " tti-001 ", "price": "1"}, format="json")
    assert result.status_code == 409
    assert Variant.objects.count() == 1
    another = Variant.objects.create(product=other, sku="OTRO", price=1)
    result = admin.patch(detail_url(another), {"sku": "tti-001"}, format="json")
    assert result.status_code == 409
    another.refresh_from_db()
    assert another.sku == "OTRO"


def test_category_attributes_create_rename_and_scope(admin, product, attribute):
    other = Category.objects.create(name="Monitores", slug="monitores")
    duplicate = admin.post(
        attributes_url(product), {"code": "color", "name": "Tono"}, format="json"
    )
    assert duplicate.status_code == 409
    second = admin.post(
        f"/api/v1/admin/categories/{other.pk}/attributes/",
        {"code": "color", "name": "Tono"},
        format="json",
    )
    assert second.status_code == 201
    assert admin.get(attributes_url(product)).data == [
        {"id": attribute.pk, "category": product.category_id, "code": "color", "name": "Color"}
    ]
    url = f"/api/v1/admin/attributes/{attribute.pk}/"
    assert (
        admin.patch(
            url, {"name": "Color exterior", "code": "color-exterior"}, format="json"
        ).status_code
        == 200
    )
    assert admin.patch(url, {"category": other.pk}, format="json").status_code == 400
    assert admin.delete(url).status_code == 405
    attribute.refresh_from_db()
    assert attribute.category_id == product.category_id
    assert attribute.code == "color-exterior"
    assert CatalogChange.objects.filter(entity="categoryattribute").count() == 2


@pytest.mark.parametrize(
    "payload",
    [
        {"code": "bad slug", "name": "Color"},
        {"code": 12, "name": "Color"},
        {"code": "color", "name": False},
        {"code": "", "name": "Color"},
        {"code": "size", "name": " "},
        {"code": "size", "name": "Size", "extra": 1},
    ],
)
def test_attribute_field_validation(admin, product, payload):
    assert admin.post(attributes_url(product), payload, format="json").status_code == 400
    assert not CategoryAttribute.objects.exists()


def test_variant_attributes_replace_clear_and_allow_same_combination(admin, product, attribute):
    payload = {
        "sku": "BLUE-1",
        "price": "10.25",
        "attributes": [{"attribute": attribute.pk, "value": " Azul "}],
    }
    result = admin.post(variant_url(product), payload, format="json")
    assert result.status_code == 201
    variant = Variant.objects.get(pk=result.data["id"])
    assert result.data["attributes"][0]["value"] == "Azul"
    assert (
        admin.post(variant_url(product), {**payload, "sku": "BLUE-2"}, format="json").status_code
        == 201
    )
    changed = admin.patch(
        detail_url(variant),
        {"attributes": [{"attribute": attribute.pk, "value": "Rojo"}]},
        format="json",
    )
    assert changed.status_code == 200
    assert variant.attribute_values.get().value == "Rojo"
    cleared = admin.patch(detail_url(variant), {"attributes": []}, format="json")
    assert cleared.status_code == 200
    assert cleared.data["attributes"] == []
    assert not variant.attribute_values.exists()
    assert VariantAttributeValue.objects.count() == 1


@pytest.mark.parametrize(
    "invalid", ["foreign", "duplicate", "blank", "number", "unknown", "string_id", "missing"]
)
def test_variant_attribute_validation_is_atomic(admin, variant, attribute, invalid):
    VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value="Original")
    entries = [{"attribute": attribute.pk, "value": "Azul"}]
    if invalid == "foreign":
        category = Category.objects.create(name="Otra", slug="otra")
        foreign = CategoryAttribute.objects.create(category=category, code="size", name="Size")
        entries[0]["attribute"] = foreign.pk
    elif invalid == "duplicate":
        entries *= 2
    elif invalid == "blank":
        entries[0]["value"] = " "
    elif invalid == "number":
        entries[0]["value"] = 10
    elif invalid == "unknown":
        entries[0]["code"] = "injected"
    elif invalid == "string_id":
        entries[0]["attribute"] = str(attribute.pk)
    else:
        entries[0]["attribute"] = 999999
    result = admin.patch(detail_url(variant), {"price": "25", "attributes": entries}, format="json")
    assert result.status_code == 400
    variant.refresh_from_db()
    assert variant.price == Decimal("1250.50")
    assert variant.attribute_values.get().value == "Original"
    assert not CatalogChange.objects.exists()


def test_audit_failure_rolls_back_price_and_attribute_replacement(admin, variant, attribute):
    VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value="Azul")
    with patch("apps.catalog.variant_views.audit", side_effect=IntegrityError("audit failed")):
        result = admin.patch(
            detail_url(variant),
            {"price": "30.25", "attributes": [{"attribute": attribute.pk, "value": "Rojo"}]},
            format="json",
        )
    assert result.status_code == 409
    variant.refresh_from_db()
    assert variant.price == Decimal("1250.50")
    assert variant.attribute_values.get().value == "Azul"
    assert not CatalogChange.objects.exists()


def test_category_change_rejects_incompatible_values_but_allows_standard_variants(
    admin, product, variant, attribute
):
    other = Category.objects.create(name="Otra", slug="otra")
    value = VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value="Azul")
    url = f"/api/v1/admin/products/{product.pk}/"
    assert admin.patch(url, {"category": other.pk}, format="json").status_code == 400
    product.refresh_from_db()
    assert product.category_id == attribute.category_id
    value.delete()
    assert admin.patch(url, {"category": other.pk}, format="json").status_code == 200
    variant.refresh_from_db()
    assert variant.product.category_id == other.pk


def test_availability_requires_complete_active_chain_and_preserves_visibility(
    admin, product, variant
):
    assert Product.objects.visible().filter(pk=product.pk).exists()
    assert Product.objects.available().filter(pk=product.pk).exists()
    assert Variant.objects.available().filter(pk=variant.pk).exists()
    for model, pk in [
        (Variant, variant.pk),
        (Product, product.pk),
        (Category, product.category_id),
        (Brand, product.brand_id),
    ]:
        model.objects.filter(pk=pk).update(is_active=False)
        assert not Product.objects.available().filter(pk=product.pk).exists()
        assert not Variant.objects.available().filter(pk=variant.pk).exists()
        assert admin.get(detail_url(variant)).data["catalog_available"] is False
        assert admin.get(f"/api/v1/admin/products/{product.pk}/").data["catalog_available"] is False
        model.objects.filter(pk=pk).update(is_active=True)
    variant.delete()
    response = admin.get(f"/api/v1/admin/products/{product.pk}/")
    assert response.data["catalog_visible"] is True
    assert response.data["catalog_available"] is False
    assert Product.objects.visible().filter(pk=product.pk).exists()
    assert not Product.objects.available().filter(pk=product.pk).exists()


def test_variant_database_constraints_and_protected_history(product, variant, attribute):
    for price in [Decimal("-0.01"), Decimal("NaN")]:
        with pytest.raises(IntegrityError), transaction.atomic():
            # Exercise the database constraint independently of Django's finite-value guard.
            with connection.cursor() as cursor:
                cursor.execute("UPDATE variants SET price = %s WHERE id = %s", [price, variant.pk])
    with pytest.raises(IntegrityError), transaction.atomic():
        Variant.objects.bulk_create([Variant(product=product, sku="tti-001", price=0)])
    with pytest.raises(IntegrityError), transaction.atomic():
        Variant.objects.create(product=product, sku=" ", price=0)
    with pytest.raises(IntegrityError), transaction.atomic():
        Variant.objects.create(product_id=999999, sku="MISSING", price=0)
        connection.check_constraints()
    VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value="Azul")
    with pytest.raises(IntegrityError), transaction.atomic():
        VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value="Rojo")
    with pytest.raises(ProtectedError):
        product.delete()
    with pytest.raises(ProtectedError):
        attribute.delete()


def test_admin_api_cannot_delete_product_with_variants(admin, product, variant):
    product.is_active = False
    product.save()
    assert admin.delete(f"/api/v1/admin/products/{product.pk}/").status_code == 409
    assert Variant.objects.filter(pk=variant.pk).exists()


def test_variants_pagination_and_product_isolation(admin, product):
    Variant.objects.bulk_create(
        [Variant(product=product, sku=f"PAGE-{i}", price=i) for i in range(22)]
    )
    other = Product.objects.create(
        name="Otro", slug="otro", category=product.category, brand=product.brand
    )
    Variant.objects.create(product=other, sku="OTHER", price=1)
    first = admin.get(variant_url(product)).data
    second = admin.get(variant_url(product) + "?page=2").data
    assert first["count"] == 22 and len(first["results"]) == 20
    assert len(second["results"]) == 2
    assert all(item["product"] == product.pk for item in first["results"] + second["results"])
    for url in [
        "/api/v1/admin/variants/not-a-number/",
        "/api/v1/admin/variants/999999/",
        "/api/v1/admin/products/999999/variants/",
        "/api/v1/admin/categories/999999/attributes/",
    ]:
        assert admin.get(url).status_code == 404


def test_variants_and_attributes_reject_visitors_clients_and_missing_csrf(
    logged_in, product, variant, attribute, user
):
    visitor = APIClient()
    urls = [variant_url(product), detail_url(variant), attributes_url(product)]
    for url in urls:
        assert visitor.get(url).status_code == 401
        assert logged_in.get(url).status_code == 403
    assert (
        logged_in.post(
            variant_url(product), {"sku": "CLIENT", "price": "1"}, format="json"
        ).status_code
        == 403
    )
    assert logged_in.patch(detail_url(variant), {"price": "1"}, format="json").status_code == 403
    assert (
        logged_in.post(
            attributes_url(product), {"name": "Size", "code": "size"}, format="json"
        ).status_code
        == 403
    )
    user.role = "ADMIN"
    user.save()
    logged_in.credentials()
    assert (
        logged_in.post(
            variant_url(product), {"sku": "CSRF", "price": "1"}, format="json"
        ).status_code
        == 403
    )
    assert logged_in.patch(detail_url(variant), {"price": "1"}, format="json").status_code == 403
    assert (
        logged_in.post(
            attributes_url(product), {"name": "Size", "code": "size"}, format="json"
        ).status_code
        == 403
    )
    assert (
        logged_in.patch(
            f"/api/v1/admin/attributes/{attribute.pk}/", {"name": "Tono"}, format="json"
        ).status_code
        == 403
    )


def race_clients(actor, callbacks):
    barrier = Barrier(len(callbacks))

    def send(callback):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=actor.pk))
            barrier.wait(timeout=10)
            return callback(client)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=len(callbacks)) as pool:
        return list(pool.map(send, callbacks))


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_sku_returns_conflict_without_partial_writes(product):
    actor = User.objects.create_user(
        "race@example.com", "Test-only!48712", name="Race", role="ADMIN"
    )
    other = Product.objects.create(
        name="Otro", slug="otro", category=product.category, brand=product.brand
    )
    callbacks = [
        lambda client: (
            client.post(
                variant_url(product), {"sku": "race-sku", "price": "10"}, format="json"
            ).status_code
        ),
        lambda client: (
            client.post(
                variant_url(other), {"sku": "RACE-SKU", "price": "20"}, format="json"
            ).status_code
        ),
    ]
    assert sorted(race_clients(actor, callbacks)) == [201, 409]
    assert Variant.objects.count() == 1
    assert CatalogChange.objects.filter(entity="variant", action="create").count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_category_change_and_attribute_assignment_keep_category_consistent(
    product, attribute
):
    actor = User.objects.create_user(
        "race@example.com", "Test-only!48712", name="Race", role="ADMIN"
    )
    other = Category.objects.create(name="Otra", slug="otra")
    callbacks = [
        lambda client: (
            client.post(
                variant_url(product),
                {
                    "sku": "RACE",
                    "price": "10",
                    "attributes": [{"attribute": attribute.pk, "value": "Azul"}],
                },
                format="json",
            ).status_code
        ),
        lambda client: (
            client.patch(
                f"/api/v1/admin/products/{product.pk}/", {"category": other.pk}, format="json"
            ).status_code
        ),
    ]
    result = race_clients(actor, callbacks)
    assert result in ([201, 400], [400, 200])
    product.refresh_from_db()
    assert not VariantAttributeValue.objects.exclude(
        attribute__category_id=product.category_id
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_price_edits_serialize_audit_before_values(product, variant):
    actor = User.objects.create_user(
        "race@example.com", "Test-only!48712", name="Race", role="ADMIN"
    )
    callbacks = [
        lambda client: (
            client.patch(detail_url(variant), {"price": "10.01"}, format="json").status_code
        ),
        lambda client: (
            client.patch(detail_url(variant), {"price": "20.02"}, format="json").status_code
        ),
    ]
    assert race_clients(actor, callbacks) == [200, 200]
    changes = list(CatalogChange.objects.filter(entity="variant").order_by("id"))
    assert len(changes) == 2
    assert changes[0].changes["price"]["before"] == "1250.50"
    assert changes[1].changes["price"]["before"] == changes[0].changes["price"]["after"]
    variant.refresh_from_db()
    assert format(variant.price, ".2f") == changes[1].changes["price"]["after"]
