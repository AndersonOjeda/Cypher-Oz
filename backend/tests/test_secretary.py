from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.catalog.models import Brand, Category, Product, Variant
from apps.inventory.models import InventoryBalance

pytestmark = pytest.mark.django_db
INTAKE = "/api/v1/admin/assistant/intake/"
CATALOG = "/api/v1/admin/assistant/catalog/"
DRAFT = {
    "products": [
        {
            "name": "Cargador",
            "description": "Carga USB-C",
            "price": None,
            "stock": None,
            "brand_name": "",
            "category_name": "",
        }
    ]
}


@pytest.fixture
def secretary_admin(logged_in, user):
    user.role = "ADMIN"
    user.save(update_fields=["role"])
    return logged_in


@pytest.fixture
def secretary_product():
    category = Category.objects.create(name="Cargadores", slug="secretary-chargers")
    brand = Brand.objects.create(name="Anker", slug="secretary-anker")
    product = Product.objects.create(
        name="Anker 65W", slug="secretary-anker-65w", category=category, brand=brand, is_active=True
    )
    variant = Variant.objects.create(product=product, sku="SECRETARY-65W", price=120000)
    InventoryBalance.objects.filter(variant=variant).update(available_quantity=4)
    return product


@pytest.mark.parametrize("path", [INTAKE, CATALOG])
def test_secretary_requires_admin(client, logged_in, path):
    logged_in.logout()
    assert client.post(path, {}, format="json").status_code in {401, 403}


def test_customer_cannot_prepare_documents(logged_in):
    with patch("apps.assistant.admin_views.generate_document") as generate:
        assert logged_in.post(INTAKE, {"text": "Cargador"}, format="json").status_code == 403
    generate.assert_not_called()


def test_intake_prepares_without_creating_products(secretary_admin):
    before = Product.objects.count()
    with patch("apps.assistant.admin_views.generate_document", return_value=DRAFT):
        response = secretary_admin.post(INTAKE, {"text": "Cargador USB-C"}, format="json")
    assert response.status_code == 200
    assert response.data["products"][0]["price"] is None
    assert response.data["products"][0]["stock"] is None
    assert response["Cache-Control"] == "no-store"
    assert Product.objects.count() == before


def test_intake_reads_clean_image(secretary_admin):
    image = BytesIO()
    Image.new("RGB", (24, 24), "white").save(image, format="PNG")
    upload = SimpleUploadedFile("provider.png", image.getvalue(), content_type="image/png")
    with patch("apps.assistant.admin_views.generate_document", return_value=DRAFT) as generate:
        response = secretary_admin.post(INTAKE, {"file": upload}, format="multipart")
    assert response.status_code == 200
    assert generate.call_args.args[1][1]["inline_data"]["mime_type"] == "image/webp"


def test_intake_rejects_fake_image_before_gemini(secretary_admin):
    upload = SimpleUploadedFile("provider.png", b"<script>bad</script>", content_type="image/png")
    with patch("apps.assistant.admin_views.generate_document") as generate:
        response = secretary_admin.post(INTAKE, {"file": upload}, format="multipart")
    assert response.status_code == 400
    generate.assert_not_called()


def test_intake_validates_request_and_model_output(secretary_admin):
    assert secretary_admin.post(INTAKE, {}, format="json").status_code == 400
    invalid = {"products": [{**DRAFT["products"][0], "price": -1}]}
    with patch("apps.assistant.admin_views.generate_document", return_value=invalid):
        assert secretary_admin.post(INTAKE, {"text": "Cargador"}, format="json").status_code == 503


def test_catalog_uses_database_prices_and_stock(secretary_admin, secretary_product):
    with patch(
        "apps.assistant.admin_views.generate_document",
        return_value={
            "title": "Accesorios para estudiar",
            "introduction": "Una selección para tu día a día.",
        },
    ):
        response = secretary_admin.post(
            CATALOG,
            {"brief": "Para estudiantes", "product_ids": [secretary_product.pk]},
            format="json",
        )
    assert response.status_code == 200
    product = response.data["products"][0]
    assert product["min_price"] == "120000.00"
    assert product["total_stock"] == 4
    assert response.data["prepared_at"]


def test_catalog_rejects_hidden_product(secretary_admin, secretary_product):
    secretary_product.category.is_active = False
    secretary_product.category.save()
    with patch("apps.assistant.admin_views.generate_document") as generate:
        response = secretary_admin.post(
            CATALOG, {"brief": "Catálogo", "product_ids": [secretary_product.pk]}, format="json"
        )
    assert response.status_code == 400
    generate.assert_not_called()


@pytest.mark.parametrize("ids", [[], [1, 1], list(range(1, 14))])
def test_catalog_selection_limits(secretary_admin, ids):
    assert (
        secretary_admin.post(
            CATALOG, {"brief": "Catálogo", "product_ids": ids}, format="json"
        ).status_code
        == 400
    )


def test_secretary_without_key_is_controlled(secretary_admin, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert secretary_admin.post(INTAKE, {"text": "Cargador"}, format="json").status_code == 503


def test_secretary_preserves_csrf(secretary_admin):
    secretary_admin.credentials()
    assert secretary_admin.post(INTAKE, {"text": "Cargador"}, format="json").status_code == 403
