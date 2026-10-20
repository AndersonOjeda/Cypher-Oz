from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance, StockMovement
from apps.orders.models import Order, OrderDelivery, OrderItem, Payment
from apps.users.models import User


@pytest.fixture
def sprint5_setup(db):
    user = User.objects.create_user(
        email="sprint5_client@test.com", password="Password123!", name="Cliente Sprint 5"
    )
    other_user = User.objects.create_user(
        email="sprint5_other@test.com", password="Password123!", name="Otro Cliente"
    )
    admin = User.objects.create_superuser(
        email="sprint5_admin@test.com", password="Password123!", name="Admin Sprint 5"
    )

    cat = Category.objects.create(name="Perifericos", slug="perifericos", is_active=True)
    brand = Brand.objects.create(name="Logitech", slug="logitech", is_active=True)
    prod = Product.objects.create(
        name="Mouse G Pro X Superlight",
        slug="mouse-g-pro-x-superlight",
        category=cat,
        brand=brand,
        is_active=True,
    )
    var = Variant.objects.create(
        product=prod, name="Blanco", sku="LOG-GPX-WHT", price=Decimal("250000.00"), is_active=True
    )
    # Set initial stock to 15
    InventoryBalance.objects.filter(variant=var).update(available_quantity=15)

    # Configure store settings
    StoreSetting.objects.update_or_create(
        key="payment_instructions", defaults={"value": "Transfiere a Nequi 3101234567"}
    )
    StoreSetting.objects.update_or_create(key="unpaid_order_timeout_hours", defaults={"value": 12})
    StoreSetting.objects.update_or_create(
        key="reported_payment_timeout_hours", defaults={"value": 24}
    )

    # Helper to create an active order with deducted stock
    def make_order(order_user, qty=2):
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
            reason="Venta de prueba",
            actor=order_user,
        )

        subtotal = var.price * qty
        ord_obj = Order.objects.create(
            user=order_user,
            idempotency_key=f"idemp-{now.timestamp()}",
            request_hash="hash123",
            subtotal=subtotal,
            discount=Decimal("0.00"),
            shipping=Decimal("0.00"),
            total=subtotal,
            status="PENDING",
        )
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
        Payment.objects.create(
            order=ord_obj,
            report_deadline_at=now + timedelta(hours=12),
            status="PENDING",
        )
        return ord_obj

    return {
        "user": user,
        "other_user": other_user,
        "admin": admin,
        "variant": var,
        "make_order": make_order,
    }


# ==================== CO-67: HU-25 Actualización automática de stock ====================


def test_restitution_links_sale_and_is_idempotent(sprint5_setup):
    from apps.orders.services import restore_cancelled_order_inventory

    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user, qty=3)
    order.status = "CANCELLED"
    order.save(update_fields=["status"])
    for _ in range(2):
        restore_cancelled_order_inventory(user, order.number, "Cancelación autorizada de prueba")
    movement = StockMovement.objects.get(type="CANCELLATION")
    assert movement.reversal_of_id == order.items.get().movement_id
    assert movement.quantity == 3
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 15
    order.payment.refresh_from_db()
    assert order.payment.status == "PENDING"  # The caller owns payment policy.


@pytest.mark.parametrize("status", ["PENDING", "PREPARING", "SHIPPED"])
def test_restitution_requires_authorized_cancellation(sprint5_setup, status):
    from apps.orders.services import CheckoutConflict, restore_cancelled_order_inventory

    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    order.status = status
    order.save(update_fields=["status"])
    with pytest.raises(CheckoutConflict):
        restore_cancelled_order_inventory(user, order.number, "Prueba")
    assert not StockMovement.objects.filter(type="CANCELLATION").exists()


def test_missing_balance_fails_without_restitution(sprint5_setup):
    from apps.orders.services import CheckoutConflict, restore_cancelled_order_inventory

    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    order.status = "CANCELLED"
    order.save(update_fields=["status"])
    InventoryBalance.objects.filter(variant=sprint5_setup["variant"]).delete()
    with pytest.raises(CheckoutConflict):
        restore_cancelled_order_inventory(user, order.number, "Prueba")
    assert not StockMovement.objects.filter(type="CANCELLATION").exists()


def test_restitution_rolls_back_with_callers_transaction(sprint5_setup):
    from django.db import transaction

    from apps.orders.services import restore_cancelled_order_inventory

    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    with pytest.raises(RuntimeError), transaction.atomic():
        order.status = "CANCELLED"
        order.save(update_fields=["status"])
        restore_cancelled_order_inventory(user, order.number, "Prueba")
        raise RuntimeError("Fallo posterior de la política de cancelación")
    order.refresh_from_db()
    assert order.status == "PENDING"
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 13
    assert not StockMovement.objects.filter(type="CANCELLATION").exists()


def test_public_cancellation_is_deferred_to_hu18(sprint5_setup):
    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.post(f"/api/v1/orders/{order.number}/cancel/", format="json").status_code == 404


@pytest.mark.parametrize("failure", ["overflow", "legacy", "foreign", "source"])
def test_restitution_rejects_inconsistent_ledger(sprint5_setup, failure):
    from apps.inventory.models import MAX_QUANTITY
    from apps.orders.services import CheckoutConflict, restore_cancelled_order_inventory

    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    order.status = "CANCELLED"
    order.save(update_fields=["status"])
    variant = sprint5_setup["variant"]
    if failure == "overflow":
        InventoryBalance.objects.filter(variant=variant).update(available_quantity=MAX_QUANTITY)
    elif failure == "legacy":
        StockMovement.objects.create(
            variant=variant,
            sku=variant.sku,
            type="CANCELLATION",
            quantity=2,
            previous_quantity=11,
            resulting_quantity=13,
            actor=user,
            reason=f"Cancelación pedido {order.number}: anterior",
        )
    elif failure == "foreign":
        user = sprint5_setup["other_user"]
    else:
        item = order.items.get()
        item.quantity = 3
        item.save(update_fields=["quantity"])
    before = InventoryBalance.objects.get(variant=variant).available_quantity
    count = StockMovement.objects.count()
    with pytest.raises(CheckoutConflict):
        restore_cancelled_order_inventory(user, order.number, "Prueba")
    assert InventoryBalance.objects.get(variant=variant).available_quantity == before
    assert StockMovement.objects.count() == count


@pytest.mark.django_db(transaction=True)
def test_concurrent_restitution_is_unique(sprint5_setup):
    from concurrent.futures import ThreadPoolExecutor

    from django.db import close_old_connections, connections

    from apps.orders.services import restore_cancelled_order_inventory

    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    order.status = "CANCELLED"
    order.save(update_fields=["status"])

    def restore():
        close_old_connections()
        try:
            restore_cancelled_order_inventory(user, order.number, "Prueba concurrente")
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(restore) for _ in range(2)]
        for future in futures:
            future.result(timeout=30)
    assert StockMovement.objects.filter(type="CANCELLATION").count() == 1
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 15


# ==================== CO-59: HU-13 Instrucciones de pago externo ====================


def test_payment_instructions_endpoint(sprint5_setup):
    user = sprint5_setup["user"]
    make_order = sprint5_setup["make_order"]
    order = make_order(user, qty=1)

    client = APIClient()
    client.force_authenticate(user=user)

    res = client.get(f"/api/v1/orders/{order.number}/payment-instructions/")
    assert res.status_code == 200
    assert res.data["number"] == str(order.number)
    assert res.data["payment_status"] == "PENDING"
    assert res.data["instructions"] == "Transfiere a Nequi 3101234567"
    assert res.data["configured"] is True
    assert "report_deadline_at" in res.data


def test_payment_instructions_unauthorized(sprint5_setup):
    user = sprint5_setup["user"]
    other_user = sprint5_setup["other_user"]
    make_order = sprint5_setup["make_order"]
    order = make_order(user, qty=1)

    anon = APIClient()
    res_anon = anon.get(f"/api/v1/orders/{order.number}/payment-instructions/")
    assert res_anon.status_code == 401

    other_cli = APIClient()
    other_cli.force_authenticate(user=other_user)
    res_other = other_cli.get(f"/api/v1/orders/{order.number}/payment-instructions/")
    assert res_other.status_code == 404


def test_current_instructions_preserve_historical_deadline_and_total(sprint5_setup):
    user = sprint5_setup["user"]
    order = sprint5_setup["make_order"](user)
    original_deadline = order.payment.report_deadline_at
    original_total = order.total
    StoreSetting.objects.filter(key="unpaid_order_timeout_hours").update(value=1)
    StoreSetting.objects.filter(key="payment_instructions").update(
        value="Synthetic instructions v2"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get(f"/api/v1/orders/{order.number}/payment-instructions/")
    assert response.status_code == 200
    assert response.data["instructions"] == "Synthetic instructions v2"
    order.refresh_from_db()
    order.payment.refresh_from_db()
    assert order.total == original_total
    assert order.payment.report_deadline_at == original_deadline
    assert order.payment.status == "PENDING"
    assert not order.payment.history.exists()
    assert not order.history.exists()


# ==================== CO-60: HU-14 Reportar pago ====================


def test_payment_report_success(sprint5_setup):
    user = sprint5_setup["user"]
    make_order = sprint5_setup["make_order"]
    order = make_order(user, qty=1)

    client = APIClient()
    client.force_authenticate(user=user)

    res = client.post(
        f"/api/v1/orders/{order.number}/payment-report/",
        {"reference": "TRANSF-987654321"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["status"] == "REPORTED"
    assert res.data["reference"] == "TRANSF-987654321"
    assert res.data["review_deadline_at"] is not None

    # Idempotent retry with same reference returns 200
    res_retry = client.post(
        f"/api/v1/orders/{order.number}/payment-report/",
        {"reference": "TRANSF-987654321"},
        format="json",
    )
    assert res_retry.status_code == 200

    # Conflicting reference returns 409
    res_conflict = client.post(
        f"/api/v1/orders/{order.number}/payment-report/",
        {"reference": "TRANSF-DIFFERENT"},
        format="json",
    )
    assert res_conflict.status_code == 409
