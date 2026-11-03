from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.catalog.models import Brand, Category, Product, Variant
from apps.inventory.models import StockMovement
from apps.orders.models import Order, OrderDelivery, OrderItem, Payment
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
