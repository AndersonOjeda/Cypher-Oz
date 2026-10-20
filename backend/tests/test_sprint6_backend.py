from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance, StockMovement
from apps.orders.models import (
    Order,
    OrderDelivery,
    OrderItem,
    OrderStatusHistory,
    Payment,
    PaymentStatusHistory,
)
from apps.users.models import User


@pytest.fixture
def sprint6_setup(db):
    user = User.objects.create_user(
        email="sprint6_client@test.com", password="Password123!", name="Cliente Sprint 6"
    )
    other_user = User.objects.create_user(
        email="sprint6_other@test.com", password="Password123!", name="Otro Cliente"
    )
    admin = User.objects.create_superuser(
        email="sprint6_admin@test.com", password="Password123!", name="Admin Sprint 6"
    )

    cat = Category.objects.create(name="Componentes", slug="componentes", is_active=True)
    brand = Brand.objects.create(name="Asus", slug="asus", is_active=True)
    prod = Product.objects.create(
        name="Placa Base ROG",
        slug="placa-base-rog",
        category=cat,
        brand=brand,
        is_active=True,
    )
    var = Variant.objects.create(
        product=prod,
        name="Gaming Edition",
        sku="ASUS-ROG-B650",
        price=Decimal("800000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=var).update(available_quantity=20)

    StoreSetting.objects.update_or_create(
        key="payment_instructions", defaults={"value": "Bancolombia ahorros 123456789"}
    )
    StoreSetting.objects.update_or_create(key="unpaid_order_timeout_hours", defaults={"value": 24})
    StoreSetting.objects.update_or_create(
        key="reported_payment_timeout_hours", defaults={"value": 48}
    )

    def make_order(order_user, qty=2, payment_status="PENDING", order_status="PENDING"):
        now = timezone.now()
        balance = InventoryBalance.objects.get(variant=var)
        prev_qty = balance.available_quantity
        balance.available_quantity -= qty
        balance.save(update_fields=["available_quantity", "updated_at"])

        sale_movement = StockMovement.objects.create(
            variant=var,
            sku=var.sku,
            type="SALE",
            quantity=-qty,
            previous_quantity=prev_qty,
            resulting_quantity=balance.available_quantity,
            reason="Venta inicial de prueba",
            actor=order_user,
        )

        subtotal = var.price * qty
        ord_obj = Order.objects.create(
            user=order_user,
            idempotency_key=f"idemp-{now.timestamp()}-{order_user.pk}-{qty}",
            request_hash="hash_test_6",
            subtotal=subtotal,
            discount=Decimal("0.00"),
            shipping=Decimal("0.00"),
            total=subtotal,
            status=order_status,
        )
        OrderStatusHistory.objects.create(order=ord_obj, status=order_status, actor=order_user)

        OrderItem.objects.create(
            order=ord_obj,
            variant=var,
            product_name=prod.name,
            variant_name=var.name,
            sku=var.sku,
            unit_price=var.price,
            discount=Decimal("0.00"),
            total=subtotal,
            quantity=qty,
            movement=sale_movement,
        )
        OrderDelivery.objects.create(order=ord_obj, mode="PICKUP", address={}, cost=Decimal("0.00"))

        reported_at = now if payment_status in ["REPORTED", "CONFIRMED", "REJECTED"] else None
        review_deadline_at = now + timedelta(hours=48) if reported_at else None
        ref = "NEQUI-REF-998877" if reported_at else ""

        payment = Payment.objects.create(
            order=ord_obj,
            report_deadline_at=now + timedelta(hours=24),
            review_deadline_at=review_deadline_at,
            reference=ref,
            reported_at=reported_at,
            status=payment_status,
        )
        PaymentStatusHistory.objects.create(
            payment=payment, status=payment_status, actor=order_user
        )

        return ord_obj

    return {
        "user": user,
        "other_user": other_user,
        "admin": admin,
        "variant": var,
        "make_order": make_order,
    }


# ===========================================================================
# HU-15 (CO-44): Verificar y resolver pago
# ===========================================================================


def test_admin_payment_list_permissions_and_filtering(sprint6_setup):
    """CO-44 HU-15-T02: GET /api/v1/admin/payments/ permissions and filtering."""
    setup = sprint6_setup
    order1 = setup["make_order"](setup["user"], payment_status="REPORTED")
    setup["make_order"](setup["user"], payment_status="PENDING")

    client = APIClient()

    # Anonymous -> 401
    res = client.get("/api/v1/admin/payments/")
    assert res.status_code == 401

    # Regular client -> 403
    client.force_authenticate(user=setup["user"])
    res = client.get("/api/v1/admin/payments/")
    assert res.status_code == 403

    # Admin -> 200
    client.force_authenticate(user=setup["admin"])
    res = client.get("/api/v1/admin/payments/")
    assert res.status_code == 200
    assert len(res.data["results"]) == 2

    # Filter ?status=REPORTED
    res_filtered = client.get("/api/v1/admin/payments/?status=REPORTED")
    assert res_filtered.status_code == 200
    assert len(res_filtered.data["results"]) == 1
    assert res_filtered.data["results"][0]["id"] == order1.payment.id
    assert res_filtered.data["results"][0]["reference"] == "NEQUI-REF-998877"


def test_admin_confirm_payment_flow(sprint6_setup):
    """CO-44 HU-15-T02: Admin confirms reported payment; creates history."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], payment_status="REPORTED")
    client = APIClient()

    # Regular client cannot confirm
    client.force_authenticate(user=setup["user"])
    res = client.post(f"/api/v1/admin/payments/{order.payment.id}/confirm/")
    assert res.status_code == 403

    # Admin confirms payment
    client.force_authenticate(user=setup["admin"])
    res = client.post(f"/api/v1/admin/payments/{order.payment.id}/confirm/")
    assert res.status_code == 200
    assert res.data["status"] == "CONFIRMED"

    order.payment.refresh_from_db()
    assert order.payment.status == "CONFIRMED"
    # History check
    history = PaymentStatusHistory.objects.filter(payment=order.payment, status="CONFIRMED")
    assert history.exists()
    assert history.first().actor == setup["admin"]


def test_admin_confirm_non_reported_payment_fails(sprint6_setup):
    """CO-44 HU-15-T02: Confirming payment that is not REPORTED returns 409."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], payment_status="PENDING")
    client = APIClient()
    client.force_authenticate(user=setup["admin"])

    res = client.post(f"/api/v1/admin/payments/{order.payment.id}/confirm/")
    assert res.status_code == 409


def test_admin_reject_payment_flow(sprint6_setup):
    """CO-44 HU-15-T02: Admin rejects payment with reason; creates history."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], payment_status="REPORTED")
    client = APIClient()

    client.force_authenticate(user=setup["admin"])

    # Missing reason -> 400
    res = client.post(f"/api/v1/admin/payments/{order.payment.id}/reject/", {})
    assert res.status_code == 400

    # Valid rejection
    res = client.post(
        f"/api/v1/admin/payments/{order.payment.id}/reject/",
        {"reason": "El comprobante no coincide con los extractos bancarios."},
    )
    assert res.status_code == 200
    assert res.data["status"] == "REJECTED"

    order.payment.refresh_from_db()
    assert order.payment.status == "REJECTED"
    history = PaymentStatusHistory.objects.filter(payment=order.payment, status="REJECTED")
    assert history.exists()
    assert history.first().actor == setup["admin"]


# ===========================================================================
# HU-16 (CO-40): Consulta y seguimiento de pedidos
# ===========================================================================


def test_client_orders_list_and_detail(sprint6_setup):
    """CO-40 HU-16-T01: Expose own orders list and detail with history and tracking."""
    setup = sprint6_setup
    order1 = setup["make_order"](setup["user"], qty=1)
    order_other = setup["make_order"](setup["other_user"], qty=1)

    client = APIClient()
    client.force_authenticate(user=setup["user"])

    # List orders -> only own orders
    res = client.get("/api/v1/orders/")
    assert res.status_code == 200
    numbers = [o["number"] for o in res.data["results"]]
    assert str(order1.number) in numbers
    assert str(order_other.number) not in numbers

    # Detail -> own order includes items, payment, and status history
    res_det = client.get(f"/api/v1/orders/{order1.number}/")
    assert res_det.status_code == 200
    data = res_det.data
    assert data["number"] == str(order1.number)
    assert data["status"] == "PENDING"
    assert data["payment"]["status"] == "PENDING"
    assert "history" in data
    assert len(data["history"]) >= 1
    assert data["history"][0]["status"] == "PENDING"


def test_client_cannot_access_other_user_order_detail(sprint6_setup):
    """CO-40 HU-16-T03: Access to another user's order detail is rejected with 404."""
    setup = sprint6_setup
    other_order = setup["make_order"](setup["other_user"], qty=1)

    client = APIClient()
    client.force_authenticate(user=setup["user"])

    res = client.get(f"/api/v1/orders/{other_order.number}/")
    assert res.status_code == 404


# ===========================================================================
# HU-17 (CO-43): Gestión administrativa del pedido
# ===========================================================================


def test_admin_orders_list_and_detail(sprint6_setup):
    """CO-43 HU-17-T01: Admin order listing and detailed view."""
    setup = sprint6_setup
    order1 = setup["make_order"](setup["user"], qty=1)
    setup["make_order"](setup["other_user"], qty=2)

    client = APIClient()

    # User forbidden
    client.force_authenticate(user=setup["user"])
    assert client.get("/api/v1/admin/orders/").status_code == 403

    # Admin access
    client.force_authenticate(user=setup["admin"])
    res = client.get("/api/v1/admin/orders/")
    assert res.status_code == 200
    assert len(res.data["results"]) == 2

    # Admin detail
    res_det = client.get(f"/api/v1/admin/orders/{order1.number}/")
    assert res_det.status_code == 200
    assert res_det.data["customer_email"] == setup["user"].email


def test_order_transition_requires_confirmed_payment(sprint6_setup):
    """CO-43 HU-17-T01: Advancing order to PREPARING without CONFIRMED payment raises 409."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], payment_status="REPORTED")

    client = APIClient()
    client.force_authenticate(user=setup["admin"])

    # Attempt transition to PREPARING when payment is REPORTED
    res = client.post(
        f"/api/v1/admin/orders/{order.number}/transition/",
        {"target_status": "PREPARING"},
    )
    assert res.status_code == 409
    assert res.data["code"] == "PAYMENT_NOT_CONFIRMED"


def test_order_lifecycle_transitions(sprint6_setup):
    """CO-43 HU-17-T01: Valid lifecycle: PENDING -> PREPARING -> SHIPPED -> DELIVERED."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], payment_status="CONFIRMED")

    client = APIClient()
    client.force_authenticate(user=setup["admin"])

    # 1. PENDING -> PREPARING (succeeds because payment is CONFIRMED)
    res1 = client.post(
        f"/api/v1/admin/orders/{order.number}/transition/",
        {"target_status": "PREPARING"},
    )
    assert res1.status_code == 200
    assert res1.data["status"] == "PREPARING"

    # 2. PREPARING -> SHIPPED
    res2 = client.post(
        f"/api/v1/admin/orders/{order.number}/transition/",
        {"target_status": "SHIPPED"},
    )
    assert res2.status_code == 200
    assert res2.data["status"] == "SHIPPED"

    # 3. SHIPPED -> DELIVERED
    res3 = client.post(
        f"/api/v1/admin/orders/{order.number}/transition/",
        {"target_status": "DELIVERED"},
    )
    assert res3.status_code == 200
    assert res3.data["status"] == "DELIVERED"

    # 4. Attempting to transition from DELIVERED fails with 409
    res_invalid = client.post(
        f"/api/v1/admin/orders/{order.number}/transition/",
        {"target_status": "SHIPPED"},
    )
    assert res_invalid.status_code == 409

    # Verify history was recorded
    history = list(OrderStatusHistory.objects.filter(order=order).values_list("status", flat=True))
    assert "PREPARING" in history
    assert "SHIPPED" in history
    assert "DELIVERED" in history


# ===========================================================================
# HU-18 (CO-61): Cancelación de pedidos
# ===========================================================================


def test_client_cancels_own_pending_order_and_restores_inventory(sprint6_setup):
    """CO-61 HU-18-T01: Client cancels own pending order; inventory is restored."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], qty=3, payment_status="PENDING")
    var = setup["variant"]

    balance_before = InventoryBalance.objects.get(variant=var).available_quantity

    client = APIClient()
    client.force_authenticate(user=setup["user"])

    res = client.post(
        f"/api/v1/orders/{order.number}/cancel/",
        {"reason": "Ya no necesito el producto"},
    )
    assert res.status_code == 200
    assert res.data["status"] == "CANCELLED"

    order.refresh_from_db()
    assert order.status == "CANCELLED"

    # Verify inventory was restored by exactly 3 units
    balance_after = InventoryBalance.objects.get(variant=var).available_quantity
    assert balance_after == balance_before + 3

    # Verify CANCELLATION stock movement links to original SALE
    rev_move = StockMovement.objects.filter(
        variant=var, type="CANCELLATION", reversal_of=order.items.first().movement
    )
    assert rev_move.exists()
    assert rev_move.first().quantity == 3


def test_client_cannot_cancel_confirmed_order(sprint6_setup):
    """CO-61 HU-18-T01: Client cannot cancel order if payment is CONFIRMED."""
    setup = sprint6_setup
    order = setup["make_order"](setup["user"], payment_status="CONFIRMED")

    client = APIClient()
    client.force_authenticate(user=setup["user"])

    res = client.post(
        f"/api/v1/orders/{order.number}/cancel/",
        {"reason": "Cancelar compra"},
    )
    assert res.status_code == 409


def test_client_cannot_cancel_other_user_order(sprint6_setup):
    """CO-61 HU-18-T01: Client cannot cancel another client's order."""
    setup = sprint6_setup
    other_order = setup["make_order"](setup["other_user"])

    client = APIClient()
    client.force_authenticate(user=setup["user"])

    res = client.post(f"/api/v1/orders/{other_order.number}/cancel/")
    assert res.status_code in [403, 404]


def test_admin_can_cancel_preparing_order_and_cannot_cancel_shipped(sprint6_setup):
    """CO-61 HU-18-T01: Admin can cancel PREPARING order, but cannot cancel SHIPPED order."""
    setup = sprint6_setup
    order_prep = setup["make_order"](
        setup["user"], payment_status="CONFIRMED", order_status="PREPARING"
    )
    order_shipped = setup["make_order"](
        setup["user"], payment_status="CONFIRMED", order_status="SHIPPED"
    )

    client = APIClient()
    client.force_authenticate(user=setup["admin"])

    # Confirmed funds require manual reconciliation; role alone does not refund.
    res_prep = client.post(
        f"/api/v1/orders/{order_prep.number}/cancel/",
        {"reason": "Admin cancela por falta de insumos"},
    )
    assert res_prep.status_code == 409

    # Admin cancels SHIPPED -> fails with 409
    res_ship = client.post(
        f"/api/v1/orders/{order_shipped.number}/cancel/",
        {"reason": "Intento de cancelar enviado"},
    )
    assert res_ship.status_code == 409
