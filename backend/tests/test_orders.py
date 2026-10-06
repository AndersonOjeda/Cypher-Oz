from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import close_old_connections, connections
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance, StockMovement
from apps.inventory.services import record_movement
from apps.orders.models import Order, OrderDelivery, OrderItem, Payment
from apps.orders.services import create_order, preview, report_payment
from apps.promotions.models import Promotion, PromotionVariant
from apps.users.models import Address, User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


@pytest.fixture
def purchase(user):
    for key, value in {
        "unpaid_order_timeout_hours": 12,
        "urban_flat_shipping_rate": 5000,
        "free_shipping_threshold": 100000,
        "anonymous_cart_ttl_days": 14,
        "reported_payment_timeout_hours": 24,
    }.items():
        StoreSetting.objects.update_or_create(key=key, defaults={"value": value})
    category = Category.objects.create(name="Accesorios", slug="accesorios")
    brand = Brand.objects.create(name="Prueba", slug="prueba")
    product = Product.objects.create(
        name="Teclado",
        slug="teclado",
        description="Prueba",
        category=category,
        brand=brand,
        is_active=True,
    )
    variant = Variant.objects.create(product=product, sku="KEY-01", price="40000.00")
    admin = User.objects.create_user("stock@example.com", PASSWORD, name="Stock", role="ADMIN")
    record_movement(
        variant_id=variant.pk,
        quantity=5,
        actor=admin,
        movement_type="ENTRY",
        reason="Stock de prueba",
    )
    address = Address.objects.create(
        user=user,
        label="Casa",
        recipient_name="Cliente",
        phone="3001234567",
        address_line="Calle 1",
        city="Pasto",
        state="Narino",
    )
    return variant, address


def payload(purchase, quantity=1, mode="URBAN"):
    variant, address = purchase
    return {
        "items": [{"variant_id": variant.pk, "quantity": quantity}],
        "address_id": address.pk,
        "delivery_mode": mode,
    }


def reviewed(client, data):
    response = client.post("/api/v1/checkout/preview/", data, format="json")
    assert response.status_code == 200, response.data
    return {**data, "quote_token": response.data["quote_token"]}, response.data


def confirm(client, data, key="order-key-001"):
    return client.post("/api/v1/orders/", data, format="json", HTTP_IDEMPOTENCY_KEY=key)


def new_payment(client, purchase, key="payment-test-001"):
    data, _ = reviewed(client, payload(purchase))
    response = confirm(client, data, key)
    assert response.status_code == 201
    return Payment.objects.get(order__number=response.data["number"])


def payment_report(client, payment, data=None):
    return client.post(
        f"/api/v1/orders/{payment.order.number}/payment-report/",
        {"reference": "TRANSFER-001"} if data is None else data,
        format="json",
    )


def test_payment_report_persists_t2_and_suspends_t1(logged_in, purchase):
    payment = new_payment(logged_in, purchase)
    t1 = payment.report_deadline_at
    response = payment_report(logged_in, payment)
    assert response.status_code == 200
    assert response.data["status"] == "REPORTED"
    assert response.data["report_window_active"] is False
    payment.refresh_from_db()
    assert payment.report_deadline_at == t1
    assert payment.review_deadline_at == payment.reported_at + timedelta(hours=24)
    assert payment.order.status == "PENDING"
    assert payment.history.filter(status="REPORTED", actor=payment.order.user).count() == 1
    assert StockMovement.objects.filter(type="SALE").count() == 1
    assert InventoryBalance.objects.get(variant=purchase[0]).available_quantity == 4


def test_t2_change_only_affects_new_reports_and_replay_never_extends(logged_in, purchase):
    first = new_payment(logged_in, purchase)
    assert payment_report(logged_in, first).status_code == 200
    first.refresh_from_db()
    deadline = first.review_deadline_at
    StoreSetting.objects.filter(key="reported_payment_timeout_hours").update(value=36)
    with patch(
        "apps.orders.services.timezone.now",
        return_value=first.report_deadline_at + timedelta(days=2),
    ):
        replay = payment_report(logged_in, first)
    assert replay.status_code == 200
    first.refresh_from_db()
    assert first.review_deadline_at == deadline
    assert first.history.filter(status="REPORTED").count() == 1
    assert payment_report(logged_in, first, {"reference": "DIFFERENT"}).status_code == 409
    second = new_payment(logged_in, purchase, "payment-test-002")
    assert payment_report(logged_in, second).status_code == 200
    second.refresh_from_db()
    assert second.review_deadline_at == second.reported_at + timedelta(hours=36)


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"reference": "  "},
        {"reference": "ab"},
        {"reference": "---"},
        {"reference": "x" * 121},
        {"reference": "a\nb"},
        {"reference": "valid", "status": "CONFIRMED"},
    ],
)
def test_invalid_payment_report_rejected(logged_in, purchase, data):
    payment = new_payment(logged_in, purchase)
    assert payment_report(logged_in, payment, data).status_code == 400
    payment.refresh_from_db()
    assert payment.status == "PENDING"
    assert payment.review_deadline_at is None


def test_payment_report_ownership_csrf_and_auth(logged_in, purchase, client):
    payment = new_payment(logged_in, purchase)
    anonymous = APIClient()
    assert payment_report(anonymous, payment).status_code == 401
    foreign = User.objects.create_user("foreign-pay@example.com", PASSWORD, name="Otro cliente")
    other = APIClient()
    other.force_authenticate(foreign)
    assert payment_report(other, payment).status_code == 404
    logged_in.credentials()
    assert payment_report(logged_in, payment).status_code == 403


@pytest.mark.parametrize(
    "order_status,payment_status",
    [
        ("CANCELLED", "PENDING"),
        ("SHIPPED", "PENDING"),
        ("PENDING", "CONFIRMED"),
        ("PENDING", "REJECTED"),
    ],
)
def test_payment_report_incompatible_state(logged_in, purchase, order_status, payment_status):
    payment = new_payment(logged_in, purchase)
    Order.objects.filter(pk=payment.order_id).update(status=order_status)
    Payment.objects.filter(pk=payment.pk).update(status=payment_status)
    assert payment_report(logged_in, payment).status_code == 409


def test_payment_report_rejects_at_t1_boundary(logged_in, purchase):
    payment = new_payment(logged_in, purchase)
    with patch("apps.orders.services.timezone.now", return_value=payment.report_deadline_at):
        assert payment_report(logged_in, payment).status_code == 409
    payment.refresh_from_db()
    assert payment.status == "PENDING"
    assert payment.review_deadline_at is None


def test_payment_report_rollback(logged_in, purchase):
    payment = new_payment(logged_in, purchase)
    with patch(
        "apps.orders.services.PaymentStatusHistory.objects.create",
        side_effect=RuntimeError("history failed"),
    ):
        with pytest.raises(RuntimeError):
            report_payment(payment.order.user, payment.order.number, "TRANSFER-001")
    payment.refresh_from_db()
    assert payment.status == "PENDING"
    assert payment.reported_at is None
    assert payment.review_deadline_at is None
    assert payment.reference == ""


@pytest.mark.django_db(transaction=True)
def test_concurrent_payment_reports_record_one_transition(purchase, user):
    data = payload(purchase)
    data["quote_token"] = preview(user, data)["quote_token"]
    order, _ = create_order(user, data, "concurrent-payment-001")

    def submit():
        close_old_connections()
        try:
            return report_payment(user, order.number, "SAME-REFERENCE").review_deadline_at
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert results[0] == results[1]
    assert order.payment.history.filter(status="REPORTED").count() == 1


def test_preview_uses_saved_address_and_does_not_reserve(logged_in, purchase):
    variant, address = purchase
    address.address_line = "Calle guardada 25"
    address.save()
    _, quote = reviewed(logged_in, payload(purchase))
    assert quote["address"]["address_line"] == "Calle guardada 25"
    assert quote["total"] == "45000.00"
    assert quote["shipping"] == "5000.00"
    assert not Order.objects.exists()
    assert InventoryBalance.objects.get(variant=variant).available_quantity == 5
    assert not StockMovement.objects.filter(type="SALE").exists()


@pytest.mark.parametrize(
    "price,shipping", [("99999.99", "5000.00"), ("100000.00", "0.00"), ("100000.01", "0.00")]
)
def test_shipping_threshold(logged_in, purchase, price, shipping):
    variant, _ = purchase
    variant.price = price
    variant.save()
    _, quote = reviewed(logged_in, payload(purchase))
    assert quote["shipping"] == shipping


def test_pickup_and_special_zone(logged_in, purchase):
    data, quote = reviewed(logged_in, payload(purchase, mode="PICKUP"))
    assert quote["address"] == {} and quote["shipping"] == "0.00"
    assert confirm(logged_in, data).status_code == 201
    data, quote = reviewed(logged_in, payload(purchase, mode="SPECIAL"))
    assert quote["shipping"] is None and quote["total"] is None
    assert not quote["can_confirm"]
    assert confirm(logged_in, data, "special-key-001").status_code == 409


@pytest.mark.parametrize("quantity", [0, -1, 1.2, True, "1", 10001])
def test_invalid_quantities_rejected(logged_in, purchase, quantity):
    assert (
        logged_in.post(
            "/api/v1/checkout/preview/", payload(purchase, quantity), format="json"
        ).status_code
        == 400
    )
    assert not Order.objects.exists()


def test_ownership_csrf_and_manipulated_amounts(logged_in, purchase, user):
    data = payload(purchase)
    other = User.objects.create_user("other@example.com", PASSWORD, name="Otro")
    purchase[1].user = other
    purchase[1].save()
    assert logged_in.post("/api/v1/checkout/preview/", data, format="json").status_code == 404
    assert (
        logged_in.post(
            "/api/v1/checkout/preview/", {**data, "total": "1.00"}, format="json"
        ).status_code
        == 400
    )
    anonymous = APIClient(enforce_csrf_checks=True)
    for path in ["/api/v1/checkout/preview/", "/api/v1/orders/"]:
        assert anonymous.post(path, data, format="json").status_code == 401
        logged_in.credentials()
        assert logged_in.post(path, data, format="json").status_code == 403


@pytest.mark.parametrize("target", ["variant", "product", "category", "brand"])
def test_inactive_chain_rejected(logged_in, purchase, target):
    variant, _ = purchase
    entity = {
        "variant": variant,
        "product": variant.product,
        "category": variant.product.category,
        "brand": variant.product.brand,
    }[target]
    entity.is_active = False
    entity.save()
    assert (
        logged_in.post("/api/v1/checkout/preview/", payload(purchase), format="json").status_code
        == 409
    )


def test_order_snapshots_survive_catalog_address_and_settings_changes(logged_in, purchase):
    variant, address = purchase
    data, _ = reviewed(logged_in, payload(purchase))
    response = confirm(logged_in, data)
    assert response.status_code == 201, response.data
    original = response.data
    assert original["status"] == original["payment"]["status"] == "PENDING"
    assert Order.objects.get().history.count() == Payment.objects.get().history.count() == 1
    assert (
        timezone.now() + timedelta(hours=11)
        < Payment.objects.get().report_deadline_at
        < timezone.now() + timedelta(hours=13)
    )
    address.address_line = "Nueva dirección"
    address.save()
    address.delete()
    variant.sku, variant.name, variant.price = "NEW-SKU", "Otro", Decimal("1.00")
    variant.save()
    variant.product.name = "Otro producto"
    variant.product.save()
    StoreSetting.objects.filter(key="unpaid_order_timeout_hours").update(value=24)
    detail = logged_in.get(f"/api/v1/orders/{original['number']}/")
    assert detail.data == original
    assert detail.data["delivery"]["address"]["address_line"] == "Calle 1"
    assert detail.data["items"][0]["sku"] == "KEY-01"
    assert detail.data["total"] == "45000.00"
    assert OrderItem.objects.get().movement.quantity == -1
    assert InventoryBalance.objects.get(variant=variant).available_quantity == 4
    assert (
        logged_in.patch(f"/api/v1/orders/{original['number']}/", {}, format="json").status_code
        == 405
    )


def test_idempotent_replay_and_conflicting_key(logged_in, purchase):
    data, _ = reviewed(logged_in, payload(purchase))
    one, two = confirm(logged_in, data), confirm(logged_in, data)
    assert one.status_code == 201 and two.status_code == 200
    assert one.data == two.data
    assert Order.objects.count() == StockMovement.objects.filter(type="SALE").count() == 1
    data["items"][0]["quantity"] = 2
    assert confirm(logged_in, data).status_code == 409


@pytest.mark.parametrize("change", ["price", "address", "shipping", "stock"])
def test_change_after_review_requires_new_review(logged_in, purchase, change):
    data, _ = reviewed(logged_in, payload(purchase))
    if change == "price":
        Variant.objects.filter(pk=purchase[0].pk).update(price=50000)
    elif change == "address":
        Address.objects.filter(pk=purchase[1].pk).update(address_line="Otra")
    elif change == "shipping":
        StoreSetting.objects.filter(key="urban_flat_shipping_rate").update(value=7000)
    else:
        InventoryBalance.objects.filter(variant=purchase[0]).update(available_quantity=0)
    assert confirm(logged_in, data).status_code == 409
    assert not Order.objects.exists()


def test_tampered_or_expired_quote_rejected(logged_in, purchase):
    data, _ = reviewed(logged_in, payload(purchase))
    assert confirm(logged_in, {**data, "quote_token": "invalid"}).status_code == 409
    with patch("django.core.signing.time.time", return_value=timezone.now().timestamp() + 901):
        assert confirm(logged_in, data).status_code == 409


def test_order_rollback_covers_all_writes(logged_in, purchase):
    data, _ = reviewed(logged_in, payload(purchase))
    with patch("apps.orders.services.Payment.objects.create", side_effect=RuntimeError("failure")):
        with pytest.raises(RuntimeError):
            confirm(logged_in, data)
    assert (
        not Order.objects.exists()
        and not OrderItem.objects.exists()
        and not OrderDelivery.objects.exists()
    )
    assert not StockMovement.objects.filter(type="SALE").exists()
    assert InventoryBalance.objects.get(variant=purchase[0]).available_quantity == 5


def test_order_list_and_detail_are_owner_scoped(logged_in, purchase):
    data, _ = reviewed(logged_in, payload(purchase))
    response = confirm(logged_in, data)
    other = User.objects.create_user("second@example.com", PASSWORD, name="Segundo")
    Order.objects.update(user=other)
    assert logged_in.get(f"/api/v1/orders/{response.data['number']}/").status_code == 404
    assert logged_in.get("/api/v1/orders/").data["count"] == 0


def test_promotion_expiry_revalidation_and_snapshot(logged_in, purchase):
    now = timezone.now()
    promotion = Promotion.objects.create(
        name="Oferta",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=1),
        is_active=True,
    )
    price = PromotionVariant.objects.create(
        promotion=promotion, variant=purchase[0], price="30000.00"
    )
    data, quote = reviewed(logged_in, payload(purchase))
    assert quote["discount"] == "10000.00" and quote["total"] == "35000.00"
    promotion.ends_at = now - timedelta(seconds=1)
    promotion.save()
    assert confirm(logged_in, data).status_code == 409
    _, full_price = reviewed(logged_in, payload(purchase))
    assert full_price["discount"] == "0.00"
    promotion.ends_at = now + timedelta(hours=1)
    promotion.save()
    data, _ = reviewed(logged_in, payload(purchase))
    order = confirm(logged_in, data)
    assert order.status_code == 201
    price.price = Decimal("20000.00")
    price.save()
    saved = logged_in.get(f"/api/v1/orders/{order.data['number']}/").data
    assert saved["total"] == "35000.00"
    assert saved["items"][0]["promotion"] == {
        "id": promotion.pk,
        "name": "Oferta",
        "price": "30000.00",
    }


def test_config_changes_apply_to_new_orders_only(logged_in, purchase):
    data, _ = reviewed(logged_in, payload(purchase))
    first = confirm(logged_in, data).data
    deadline = Payment.objects.get().report_deadline_at
    StoreSetting.objects.filter(key="unpaid_order_timeout_hours").update(value=24)
    StoreSetting.objects.filter(key="urban_flat_shipping_rate").update(value=6000)
    data, quote = reviewed(logged_in, payload(purchase))
    assert quote["total"] == "46000.00"
    second = confirm(logged_in, data, "new-order-002").data
    assert Payment.objects.get(
        order__number=second["number"]
    ).report_deadline_at > deadline + timedelta(hours=11)
    assert logged_in.get(f"/api/v1/orders/{first['number']}/").data == first


def test_confirmed_discounted_shipping_threshold_and_no_promotion_stacking(logged_in, purchase):
    now = timezone.now()
    offer = Promotion.objects.create(
        name="Precio fijo",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=1),
        is_active=True,
    )
    PromotionVariant.objects.create(promotion=offer, variant=purchase[0], price="30000.00")
    _, quote = reviewed(logged_in, payload(purchase, quantity=3))
    assert quote["subtotal"] == "120000.00"
    assert quote["discount"] == "30000.00"
    assert quote["shipping"] == "5000.00"
    assert quote["total"] == "95000.00"
    other = Promotion.objects.create(
        name="Otra oferta",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=1),
        is_active=True,
    )
    PromotionVariant.objects.create(promotion=other, variant=purchase[0], price="29000.00")
    response = logged_in.post("/api/v1/checkout/preview/", payload(purchase), format="json")
    assert response.status_code == 409
    assert not Order.objects.exists()


def test_payment_instructions_and_public_purchase_data(logged_in, purchase):
    public = APIClient().get("/api/v1/purchase/variants/")
    assert public.status_code == 200
    assert public.data["cart_ttl_days"] == 14
    StoreSetting.objects.filter(key="anonymous_cart_ttl_days").update(value=3)
    assert APIClient().get("/api/v1/purchase/variants/").data["cart_ttl_days"] == 3
    data, _ = reviewed(logged_in, payload(purchase))
    order = confirm(logged_in, data).data
    path = f"/api/v1/orders/{order['number']}/payment-instructions/"
    assert not logged_in.get(path).data["configured"]
    StoreSetting.objects.update_or_create(
        key="payment_instructions", defaults={"value": "Prueba controlada: no transferir dinero."}
    )
    assert logged_in.get(path).data["configured"]
    assert APIClient().get(path).status_code == 401


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_user", [False, True])
def test_concurrent_last_unit_and_idempotency(purchase, user, same_user):
    InventoryBalance.objects.filter(variant=purchase[0]).update(available_quantity=1)
    other = (
        user
        if same_user
        else User.objects.create_user("buyer2@example.com", PASSWORD, name="Segundo")
    )
    data = {
        "items": [{"variant_id": purchase[0].pk, "quantity": 1}],
        "delivery_mode": "PICKUP",
        "address_id": None,
    }
    first = {**data, "quote_token": preview(user, data)["quote_token"]}
    second = first if same_user else {**data, "quote_token": preview(other, data)["quote_token"]}

    def run(buyer, body):
        close_old_connections()
        try:
            from apps.orders.services import CheckoutConflict

            try:
                order, created = create_order(buyer, body, "concurrent-key")
                return str(order.number), created
            except CheckoutConflict:
                return None
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(run, user, first), pool.submit(run, other, second)]
        results = [future.result(timeout=30) for future in futures]
    assert Order.objects.count() == 1
    assert StockMovement.objects.filter(type="SALE").count() == 1
    assert InventoryBalance.objects.get(variant=purchase[0]).available_quantity == 0
    if same_user:
        assert results[0][0] == results[1][0]
        assert sorted(result[1] for result in results) == [False, True]
    else:
        assert results.count(None) == 1
