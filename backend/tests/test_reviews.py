from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier

import pytest
from django.db import close_old_connections, connection, connections
from django.utils import timezone

from apps.catalog.models import Brand, Category, Product, Variant
from apps.inventory.models import StockMovement
from apps.orders.models import Order, OrderDelivery, OrderItem, Payment
from apps.reviews.models import ProductReview, ReviewModerationLog, ReviewReport
from apps.reviews.services import (
    ReportAlreadyActiveConflict,
    ReviewAlreadyExistsConflict,
    create_verified_review,
    moderate_review,
    report_review,
)
from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def review_purchase(user):
    category = Category.objects.create(name="Audio", slug="audio")
    brand = Brand.objects.create(name="Marca", slug="marca")
    product = Product.objects.create(
        name="Audífonos",
        slug="audifonos",
        description="Prueba",
        category=category,
        brand=brand,
        is_active=True,
    )
    variant = Variant.objects.create(product=product, name="Negro", sku="AUD-1", price="50000")
    movement = StockMovement.objects.create(
        variant=variant,
        sku=variant.sku,
        type="SALE",
        quantity=-1,
        previous_quantity=1,
        resulting_quantity=0,
        reason="Pedido de prueba",
        actor=user,
    )
    order = Order.objects.create(
        user=user,
        idempotency_key="review-order",
        request_hash="test",
        status="DELIVERED",
        subtotal=Decimal("50000"),
        discount=0,
        shipping=0,
        total=Decimal("50000"),
    )
    item = OrderItem.objects.create(
        order=order,
        variant=variant,
        product_name=product.name,
        variant_name=variant.name,
        sku=variant.sku,
        quantity=1,
        unit_price=Decimal("50000"),
        discount=0,
        total=Decimal("50000"),
        movement=movement,
    )
    OrderDelivery.objects.create(order=order, mode="PICKUP", address={}, cost=0)
    Payment.objects.create(
        order=order,
        status="CONFIRMED",
        report_deadline_at=timezone.now() + timedelta(days=1),
    )
    return product, variant, order, item


def test_verified_review_public_summary_and_private_fields(client, logged_in, review_purchase):
    product, _, _, item = review_purchase
    created = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 5, "comment": "Muy buenos"},
        format="json",
    )
    assert created.status_code == 201, created.data
    assert created.data["verified_purchase"] is True
    public = client.get(f"/api/v1/products/{product.slug}/reviews/")
    assert public.status_code == 200
    assert public.data["summary"]["average_rating_display"] == "5,0"
    assert public.data["summary"]["review_count"] == 1
    assert public.data["results"][0]["verified_label"] == "Compra verificada"
    assert "order_item_id" not in public.data["results"][0]
    assert "email" not in public.data["results"][0]


def test_review_rejects_other_users_and_invalid_rating(client, logged_in, review_purchase, user):
    _, _, _, item = review_purchase
    other = User.objects.create_user("other@example.com", "Clave-Segura!9234", name="Otra")
    item.order.user = other
    item.order.save(update_fields=["user"])
    response = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 5, "comment": "Prueba"},
        format="json",
    )
    assert response.status_code == 403
    item.order.user = user
    item.order.save(update_fields=["user"])
    invalid = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 6, "comment": "Prueba"},
        format="json",
    )
    assert invalid.status_code == 400


def test_report_does_not_hide_review_and_admin_moderation_is_audited(
    client, logged_in, review_purchase, user
):
    product, _, _, item = review_purchase
    created = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 1, "comment": "No me gustó"},
        format="json",
    )
    assert created.status_code == 201
    reported = logged_in.post(
        f"/api/v1/reviews/{created.data['id']}/report/",
        {"reason": "Quiero que se revise"},
        format="json",
    )
    assert reported.status_code == 201
    assert (
        client.get(f"/api/v1/products/{product.slug}/reviews/").data["summary"]["review_count"] == 1
    )
    user.role = User.Role.ADMIN
    user.save(update_fields=["role"])
    moderated = logged_in.post(
        f"/api/v1/admin/reviews/{created.data['id']}/moderate/",
        {"action": "HIDE", "reason": "Incumple la política de reseñas"},
        format="json",
    )
    assert moderated.status_code == 200
    assert moderated.data["visibility"] == "HIDDEN"
    assert (
        client.get(f"/api/v1/products/{product.slug}/reviews/").data["summary"]["review_count"] == 0
    )


def test_hidden_review_remains_editable_by_author_without_republication(logged_in, review_purchase):
    _, _, _, item = review_purchase
    created = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 4, "comment": "Buena"},
        format="json",
    )
    review_id = created.data["id"]
    user = item.order.user
    user.role = User.Role.ADMIN
    user.save(update_fields=["role"])
    logged_in.post(
        f"/api/v1/admin/reviews/{review_id}/moderate/",
        {"action": "HIDE", "reason": "Revisión de política"},
        format="json",
    )
    edited = logged_in.patch(
        f"/api/v1/reviews/{review_id}/", {"comment": "Comentario actualizado"}, format="json"
    )
    assert edited.status_code == 200
    assert edited.data["visibility"] == "HIDDEN"
    assert edited.data["comment"] == "Comentario actualizado"


def concurrent_pair(operation):
    """Use independent PostgreSQL transactions, released at the same time."""
    barrier = Barrier(2)

    def submit(_):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return operation()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(submit, range(2)))


@pytest.mark.parametrize(
    "order_status,payment_status",
    [
        ("PENDING", "CONFIRMED"),
        ("CANCELLED", "CONFIRMED"),
        ("SHIPPED", "CONFIRMED"),
        ("DELIVERED", "PENDING"),
        ("DELIVERED", "REPORTED"),
    ],
)
def test_ineligible_purchase_cannot_review(
    logged_in, review_purchase, order_status, payment_status
):
    _, _, order, item = review_purchase
    order.status = order_status
    order.save(update_fields=["status"])
    payment_fields = {"status": payment_status}
    if payment_status == "REPORTED":
        payment_fields.update(
            reference="Referencia de prueba",
            reported_at=timezone.now(),
            review_deadline_at=timezone.now() + timedelta(hours=24),
        )
    Payment.objects.filter(order=order).update(**payment_fields)
    response = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 5, "comment": "Prueba"},
        format="json",
    )
    assert response.status_code == 403
    assert not ProductReview.objects.exists()


@pytest.mark.parametrize(
    "rating,comment",
    [
        (0, "Prueba"),
        (6, "Prueba"),
        (2.5, "Prueba"),
        (5, "   "),
        (5, "x" * 1001),
    ],
)
def test_invalid_review_does_not_persist(logged_in, review_purchase, rating, comment):
    _, _, _, item = review_purchase
    response = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": rating, "comment": comment},
        format="json",
    )
    assert response.status_code == 400
    assert not ProductReview.objects.exists()


def test_other_author_and_client_cannot_edit_or_moderate(logged_in, review_purchase, user):
    product, _, _, item = review_purchase
    other = User.objects.create(email="review-author@example.com", name="Otra Persona")
    review = ProductReview.objects.create(
        user=other, product=product, order_item=item, rating=1, comment="Opinión original"
    )
    assert (
        logged_in.patch(
            f"/api/v1/reviews/{review.id}/", {"comment": "Suplantación"}, format="json"
        ).status_code
        == 403
    )
    assert (
        logged_in.post(
            f"/api/v1/admin/reviews/{review.id}/moderate/",
            {"action": "HIDE", "reason": "No autorizado"},
            format="json",
        ).status_code
        == 403
    )
    review.refresh_from_db()
    assert review.comment == "Opinión original"
    assert review.visibility == "VISIBLE"


def test_public_averages_follow_edit_hide_and_empty(client, review_purchase, user):
    product, _, _, item = review_purchase
    reviews = []
    for index, rating in enumerate([5, 4, 2]):
        author = User.objects.create(email=f"average-{index}@example.com", name="Nombre Apellido")
        reviews.append(
            ProductReview.objects.create(
                user=author, product=product, order_item=item, rating=rating, comment="Opinión"
            )
        )

    def summary():
        response = client.get(f"/api/v1/products/{product.slug}/reviews/")
        assert response.status_code == 200
        for review in response.data["results"]:
            assert not {"email", "order_item_id", "order_number", "reports"} & review.keys()
        return response.data["summary"]

    assert summary()["average_rating_display"] == "3,7"
    reviews[-1].rating = 3
    reviews[-1].save(update_fields=["rating"])
    assert summary()["average_rating_display"] == "4,0"
    reviews[-1].visibility = "HIDDEN"
    reviews[-1].save(update_fields=["visibility"])
    assert summary()["average_rating_display"] == "4,5"
    assert summary()["review_count"] == 2
    ProductReview.objects.update(visibility="HIDDEN")
    assert summary()["average_rating"] is None
    assert summary()["review_count"] == 0


def test_public_pagination_is_stable_and_products_are_isolated(client, review_purchase):
    product, variant, _, item = review_purchase
    second_variant = Variant.objects.create(
        product=product, sku="AUD-2", name="Blanco", price="50000"
    )
    second_movement = StockMovement.objects.create(
        variant=second_variant,
        sku="AUD-2",
        type="SALE",
        quantity=-1,
        previous_quantity=1,
        resulting_quantity=0,
        reason="Segunda variante de prueba",
        actor=item.order.user,
    )
    second_item = OrderItem.objects.create(
        order=item.order,
        variant=second_variant,
        product_name=product.name,
        variant_name="Blanco",
        sku="AUD-2",
        quantity=1,
        unit_price="50000",
        discount=0,
        total="50000",
        movement=second_movement,
    )
    expected_ids = []
    for index in range(6):
        author = User.objects.create(email=f"page-{index}@example.com", name="Nombre Apellido")
        review = ProductReview.objects.create(
            user=author,
            product=product,
            order_item=second_item if index % 2 else item,
            rating=4,
            comment="Opinión de variante",
        )
        expected_ids.insert(0, review.id)
    other = Product.objects.create(
        name="Otro", slug="otro", category=product.category, brand=product.brand, is_active=True
    )
    ProductReview.objects.create(
        user=author, product=other, order_item=item, rating=1, comment="Otro producto"
    )
    first = client.get(f"/api/v1/products/{product.slug}/reviews/").data
    second = client.get(f"/api/v1/products/{product.slug}/reviews/?page=2").data
    assert first["summary"]["average_rating_display"] == "4,0"
    assert first["summary"]["review_count"] == 6
    assert [r["id"] for r in first["results"] + second["results"]] == expected_ids
    assert first["next"] and second["previous"]
    assert (
        len(client.get(f"/api/v1/products/{product.slug}/reviews/?page_size=999").data["results"])
        <= 20
    )


@pytest.mark.parametrize("field,value", [("user", 999), ("product", 999), ("visibility", "HIDDEN")])
def test_client_cannot_inject_internal_review_fields(logged_in, review_purchase, field, value):
    _, _, _, item = review_purchase
    response = logged_in.post(
        "/api/v1/reviews/",
        {"order_item_id": item.id, "rating": 5, "comment": "Prueba", field: value},
        format="json",
    )
    assert response.status_code == 400
    assert not ProductReview.objects.exists()


def test_report_permissions_and_moderation_reason_are_enforced(client, review_purchase, user):
    _, _, _, item = review_purchase
    review = create_verified_review(
        user, {"order_item_id": item.id, "rating": 1, "comment": "No me gustó"}
    )
    assert client.post(
        f"/api/v1/reviews/{review.id}/report/", {"reason": "Revisar"}, format="json"
    ).status_code in {401, 403}
    from rest_framework.test import APIClient

    admin = APIClient(enforce_csrf_checks=True)
    user.role = User.Role.ADMIN
    user.save(update_fields=["role"])
    admin.force_authenticate(user=user)
    response = admin.post(
        f"/api/v1/admin/reviews/{review.id}/moderate/",
        {"action": "HIDE", "reason": " "},
        format="json",
    )
    assert response.status_code == 400
    assert ReviewModerationLog.objects.count() == 0
    assert ProductReview.objects.get(pk=review.id).visibility == "VISIBLE"


@pytest.mark.django_db(transaction=True)
def test_concurrent_review_creation_has_one_winner(review_purchase, user):
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locking")
    product, _, _, item = review_purchase

    def create():
        try:
            create_verified_review(user, {"order_item_id": item.id, "rating": 4, "comment": "Bien"})
            return 201
        except ReviewAlreadyExistsConflict:
            return 409

    assert sorted(concurrent_pair(create)) == [201, 409]
    assert ProductReview.objects.filter(user=user, product=product).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_reports_create_one_open_report(review_purchase, user):
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locking")
    _, _, _, item = review_purchase
    review = create_verified_review(
        user, {"order_item_id": item.id, "rating": 1, "comment": "No me gustó"}
    )

    def report():
        try:
            report_review(user, review.id, "Revisar contenido")
            return 201
        except ReportAlreadyActiveConflict:
            return 409

    assert sorted(concurrent_pair(report)) == [201, 409]
    assert ReviewReport.objects.filter(review=review, status="OPEN").count() == 1
    review.refresh_from_db()
    assert review.visibility == "VISIBLE"


@pytest.mark.django_db(transaction=True)
def test_concurrent_moderation_is_idempotent(review_purchase, user):
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locking")
    _, _, _, item = review_purchase
    review = create_verified_review(
        user, {"order_item_id": item.id, "rating": 1, "comment": "No me gustó"}
    )
    report_review(user, review.id, "Revisar contenido")
    user.role = User.Role.ADMIN
    user.save(update_fields=["role"])

    def moderate():
        return moderate_review(user, review.id, "HIDE", "Incumple política").visibility

    assert concurrent_pair(moderate) == ["HIDDEN", "HIDDEN"]
    assert ReviewModerationLog.objects.filter(review=review, action="HIDE").count() == 1
    assert ReviewReport.objects.filter(review=review, status="RESOLVED_HIDDEN").count() == 1
