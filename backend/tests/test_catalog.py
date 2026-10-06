import io
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest.mock import patch

import pytest
from botocore.exceptions import EndpointConnectionError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.catalog.models import (
    Brand,
    CatalogChange,
    Category,
    Product,
    ProductImage,
    StorageDeletion,
)
from apps.catalog.storage import StorageUnavailable, cleanup_images, validate_image
from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(logged_in, user):
    user.role = "ADMIN"
    user.save()
    return logged_in


@pytest.fixture
def product():
    category = Category.objects.create(name="Teclados", slug="teclados")
    brand = Brand.objects.create(name="TTI Test", slug="tti-test")
    return Product.objects.create(
        name="Teclado",
        slug="teclado",
        description="Teclado USB",
        category=category,
        brand=brand,
        is_active=True,
    )


@pytest.fixture
def storage(settings):
    settings.CATALOG_S3_BUCKET = "test-bucket"
    with patch("apps.catalog.storage.storage_client") as client:
        client.return_value.generate_presigned_url.return_value = "http://example.test/image.webp"
        yield client.return_value


def picture(name="photo.png", mime="image/png", size=(100, 80)):
    output = io.BytesIO()
    Image.new("RGB", size, "blue").save(output, "PNG")
    return SimpleUploadedFile(name, output.getvalue(), content_type=mime)


@pytest.mark.parametrize("kind", ["categories", "brands", "products", "catalog/limits"])
def test_catalog_rejects_visitors_and_clients(client, logged_in, kind):
    visitor = APIClient()
    assert visitor.get(f"/api/v1/admin/{kind}/").status_code == 401
    assert logged_in.get(f"/api/v1/admin/{kind}/").status_code == 403
    assert logged_in.post(f"/api/v1/admin/{kind}/", {}, format="json").status_code == 403


@pytest.mark.parametrize("kind", ["categories", "brands"])
def test_taxonomy_crud_validation_and_audit(admin, kind):
    url = f"/api/v1/admin/{kind}/"
    response = admin.post(url, {"name": "Accesorios", "slug": "accesorios"}, format="json")
    assert response.status_code == 201
    identity = response.data["id"]
    assert admin.get(url).data["count"] == 1
    assert (
        admin.post(url, {"name": "ACCESORIOS", "slug": "another"}, format="json").status_code == 400
    )
    assert admin.post(url, {"name": "Otro", "slug": "accesorios"}, format="json").status_code == 400
    for invalid in [{"name": " "}, {"role": "ADMIN"}, {"slug": "bad slug"}]:
        assert admin.patch(f"{url}{identity}/", invalid, format="json").status_code == 400
    assert admin.patch(f"{url}{identity}/", {"is_active": False}, format="json").status_code == 200
    assert admin.get(url + "?active=false&search=acce").data["count"] == 1
    assert admin.get(url + "?active=true").data["count"] == 0
    assert admin.delete(f"{url}{identity}/").status_code == 204
    assert admin.get(f"{url}{identity}/").status_code == 404
    assert CatalogChange.objects.count() == 3


def test_product_crud_policy_and_protected_relations(admin, product):
    base = "/api/v1/admin/products/"
    payload = {
        "name": "Mouse",
        "slug": "mouse",
        "description": "Mouse USB",
        "category": product.category_id,
        "brand": product.brand_id,
    }
    created = admin.post(base, payload, format="json")
    assert created.status_code == 201
    assert created.data["is_active"] is False
    url = f"{base}{created.data['id']}/"
    changed = admin.patch(url, {"is_active": True, "warranty": "12 meses"}, format="json")
    assert changed.status_code == 200
    assert changed.data["catalog_visible"] is True
    assert admin.delete(url).status_code == 409
    assert admin.delete(f"/api/v1/admin/categories/{product.category_id}/").status_code == 409
    assert admin.delete(f"/api/v1/admin/brands/{product.brand_id}/").status_code == 409
    admin.patch(
        f"/api/v1/admin/categories/{product.category_id}/", {"is_active": False}, format="json"
    )
    assert admin.get(url).data["catalog_visible"] is False
    assert not Product.objects.visible().exists()
    assert admin.post(base, {**payload, "slug": "mouse-new"}, format="json").status_code == 400
    assert admin.patch(url, {"is_active": False}, format="json").status_code == 200
    assert admin.delete(url).status_code == 204
    product.refresh_from_db()
    assert product.category_id is not None


@pytest.mark.parametrize(
    "payload",
    [
        {"price": 1},
        {"stock": 99},
        {"sku": "X"},
        {"category": 99999},
        {"name": ""},
        {"slug": "bad slug"},
    ],
)
def test_product_invalid_payload_is_not_persisted(admin, product, payload):
    assert (
        admin.patch(f"/api/v1/admin/products/{product.pk}/", payload, format="json").status_code
        == 400
    )
    product.refresh_from_db()
    assert product.name == "Teclado"


def test_csrf_on_catalog_mutation(admin, product):
    admin.credentials()
    assert (
        admin.patch(
            f"/api/v1/admin/products/{product.pk}/", {"name": "Changed"}, format="json"
        ).status_code
        == 403
    )
    assert (
        admin.post(
            f"/api/v1/admin/products/{product.pk}/images/", {"file": picture(), "alt_text": "Test"}
        ).status_code
        == 403
    )


def test_database_constraints(product):
    with pytest.raises(IntegrityError), transaction.atomic():
        Category.objects.create(name="TECLADOS", slug="another")
    with pytest.raises(IntegrityError), transaction.atomic():
        Brand.objects.create(name="tti TEST", slug="another")
    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.create(
            name="Invalid", slug="another", category_id=99999, brand=product.brand
        )
        connection.check_constraints()


def test_pagination_search_and_missing(admin):
    Category.objects.bulk_create(
        [Category(name=f"Category {i:02}", slug=f"cat-{i}") for i in range(22)]
    )
    first = admin.get("/api/v1/admin/categories/").data
    second = admin.get("/api/v1/admin/categories/?page=2").data
    assert first["count"] == 22 and len(first["results"]) == 20
    assert len(second["results"]) == 2
    assert admin.get("/api/v1/admin/categories/?search=cat-21").data["count"] == 1
    assert admin.get("/api/v1/admin/categories/?active=invalid").status_code == 400
    assert (
        admin.patch("/api/v1/admin/products/99999/", {"name": "Absent"}, format="json").status_code
        == 404
    )
    assert (
        admin.patch("/api/v1/admin/products/not-an-id/", {"name": "Bad"}, format="json").status_code
        == 404
    )


def test_real_image_decode_reencodes_and_strips_trailing_content():
    original = picture()
    upload = SimpleUploadedFile(
        "photo.png", original.read() + b"<script>payload</script>", content_type="image/png"
    )
    content, width, height = validate_image(upload)
    assert (width, height) == (100, 80)
    assert b"<script>" not in content
    assert Image.open(io.BytesIO(content)).format == "WEBP"


@pytest.mark.parametrize(
    "invalid", ["svg", "broken", "mime", "extension", "large", "dimensions", "animated"]
)
def test_invalid_images_rejected_before_storage(admin, product, storage, settings, invalid):
    upload = picture()
    if invalid == "svg":
        upload = SimpleUploadedFile("photo.svg", b"<svg onload='x'/>", content_type="image/svg+xml")
    elif invalid == "broken":
        upload = SimpleUploadedFile("photo.png", b"not an image", content_type="image/png")
    elif invalid == "mime":
        upload = picture(mime="image/jpeg")
    elif invalid == "extension":
        upload = picture(name="photo.jpg")
    elif invalid == "large":
        settings.CATALOG_IMAGE_MAX_BYTES = 10
    elif invalid == "dimensions":
        settings.CATALOG_IMAGE_MAX_DIMENSION = 50
    else:
        output = io.BytesIO()
        Image.new("RGB", (20, 20), "red").save(
            output, "PNG", save_all=True, append_images=[Image.new("RGB", (20, 20), "blue")]
        )
        upload = SimpleUploadedFile("photo.png", output.getvalue(), content_type="image/png")
    result = admin.post(
        f"/api/v1/admin/products/{product.pk}/images/",
        {"file": upload, "alt_text": "Vista frontal"},
    )
    assert result.status_code == 400
    assert not ProductImage.objects.exists()
    storage.put_object.assert_not_called()


def test_image_upload_order_edit_delete_and_storage_cleanup(
    admin, product, storage, django_capture_on_commit_callbacks
):
    url = f"/api/v1/admin/products/{product.pk}/images/"
    first = admin.post(url, {"file": picture(), "alt_text": "Frontal"})
    assert (
        admin.patch(f"{url}{first.data['id']}/", {"sort_order": 32767}, format="json").status_code
        == 200
    )
    second = admin.post(url, {"file": picture(), "alt_text": "Trasera"})
    assert first.status_code == second.status_code == 201
    image = ProductImage.objects.get(pk=first.data["id"])
    assert image.storage_url.startswith("http") and image.content_type == "image/webp"
    assert not StorageDeletion.objects.exists()
    assert storage.put_object.call_count == 2
    result = admin.patch(
        f"{url}{second.data['id']}/", {"sort_order": 0, "alt_text": "Principal"}, format="json"
    )
    assert result.status_code == 200
    assert admin.get(url).data[0]["alt_text"] == "Principal"
    assert (
        admin.get(f"/api/v1/admin/products/{product.pk}/").data["images"][0]["alt_text"]
        == "Principal"
    )
    with django_capture_on_commit_callbacks(execute=True):
        assert admin.delete(f"{url}{first.data['id']}/").status_code == 204
    assert not ProductImage.objects.filter(pk=image.pk).exists()
    storage.delete_object.assert_called_once()
    assert not StorageDeletion.objects.exists()
    assert (
        admin.patch(
            f"{url}{second.data['id']}/", {"url": "http://evil.test"}, format="json"
        ).status_code
        == 400
    )
    assert admin.get(url)["Cache-Control"] == "no-store"


def test_upload_failure_has_no_metadata_and_retains_compensation(admin, product, storage):
    storage.put_object.side_effect = EndpointConnectionError(endpoint_url="http://offline.test")
    result = admin.post(
        f"/api/v1/admin/products/{product.pk}/images/", {"file": picture(), "alt_text": "Test"}
    )
    assert result.status_code == 503
    assert result.data["code"] == "storage_unavailable"
    assert not ProductImage.objects.exists()
    assert StorageDeletion.objects.count() == 1
    assert cleanup_images() == 0  # in-flight uploads have a grace period


def test_delete_outage_retains_retry_record(
    admin, product, storage, django_capture_on_commit_callbacks
):
    url = f"/api/v1/admin/products/{product.pk}/images/"
    uploaded = admin.post(url, {"file": picture(), "alt_text": "Test"})
    storage.delete_object.side_effect = StorageUnavailable()
    with django_capture_on_commit_callbacks(execute=True):
        assert admin.delete(f"{url}{uploaded.data['id']}/").status_code == 204
    assert not ProductImage.objects.exists()
    assert StorageDeletion.objects.count() == 1
    storage.delete_object.side_effect = None
    assert cleanup_images() == 1
    assert not StorageDeletion.objects.exists()


def test_no_cross_product_image_mutation(admin, product, storage):
    url = f"/api/v1/admin/products/{product.pk}/images/"
    image = admin.post(url, {"file": picture(), "alt_text": "Test"}).data
    other = Product.objects.create(
        name="Other", slug="other", category=product.category, brand=product.brand
    )
    wrong = f"/api/v1/admin/products/{other.pk}/images/{image['id']}/"
    assert admin.patch(wrong, {"alt_text": "Wrong"}, format="json").status_code == 404
    assert admin.delete(wrong).status_code == 404


def test_client_cannot_upload_or_delete_images(logged_in, product):
    url = f"/api/v1/admin/products/{product.pk}/images/"
    assert logged_in.post(url, {"file": picture(), "alt_text": "Test"}).status_code == 403
    assert logged_in.delete(url + "1/").status_code == 403


@pytest.mark.django_db(transaction=True)
def test_concurrent_upload_enforces_product_limit(product, storage, settings):
    settings.CATALOG_IMAGE_MAX_COUNT = 1
    actor = User.objects.create_user(
        "race@example.com", "Race-only!89473", name="Test", role="ADMIN"
    )

    def send(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=actor.pk))
            return client.post(
                f"/api/v1/admin/products/{product.pk}/images/",
                {"file": picture(), "alt_text": "Test"},
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(pool.map(send, range(2)))
    assert results == [201, 400]
    assert product.images.count() == 1
    # Failed/incomplete uploads are swept after the grace period.
    StorageDeletion.objects.update(available_at=timezone.now() - timedelta(seconds=1))
    cleanup_images()
    assert product.images.count() == 1
