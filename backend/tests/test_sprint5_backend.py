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


def test_order_cancellation_restitutes_stock_with_movement(sprint5_setup):
    user = sprint5_setup["user"]
    var = sprint5_setup["variant"]
    make_order = sprint5_setup["make_order"]

    order = make_order(user, qty=3)
    # Available was 15 - 3 = 12
    assert InventoryBalance.objects.get(variant=var).available_quantity == 12

    client = APIClient()
    client.force_authenticate(user=user)

    res = client.post(
        f"/api/v1/orders/{order.number}/cancel/",
        {"reason": "Me equivoqué de modelo"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["status"] == "CANCELLED"

    # Verify inventory was restituted: 12 + 3 = 15
    balance = InventoryBalance.objects.get(variant=var)
    assert balance.available_quantity == 15

    # Verify StockMovement was recorded
    movement = StockMovement.objects.filter(variant=var, type="CANCELLATION").first()
    assert movement is not None
    assert movement.quantity == 3  # positive
    assert movement.previous_quantity == 12
    assert movement.resulting_quantity == 15
    assert "Cancelación pedido" in movement.reason
    assert "Me equivoqué de modelo" in movement.reason


def test_order_cancellation_cannot_restitute_twice(sprint5_setup):
    user = sprint5_setup["user"]
    var = sprint5_setup["variant"]
    make_order = sprint5_setup["make_order"]

    order = make_order(user, qty=2)
    # Available is 15 - 2 = 13
    assert InventoryBalance.objects.get(variant=var).available_quantity == 13

    client = APIClient()
    client.force_authenticate(user=user)

    # First cancellation succeeds
    res1 = client.post(f"/api/v1/orders/{order.number}/cancel/", format="json")
    assert res1.status_code == 200
    assert InventoryBalance.objects.get(variant=var).available_quantity == 15

    # Second cancellation fails with 409 and does not restock again
    res2 = client.post(f"/api/v1/orders/{order.number}/cancel/", format="json")
    assert res2.status_code == 409
    assert InventoryBalance.objects.get(variant=var).available_quantity == 15

    # Exactly one CANCELLATION movement
    assert StockMovement.objects.filter(variant=var, type="CANCELLATION").count() == 1


def test_non_owner_cannot_cancel_order(sprint5_setup):
    user = sprint5_setup["user"]
    other_user = sprint5_setup["other_user"]
    make_order = sprint5_setup["make_order"]

    order = make_order(user, qty=2)

    client = APIClient()
    client.force_authenticate(user=other_user)

    res = client.post(f"/api/v1/orders/{order.number}/cancel/", format="json")
    assert res.status_code == 409 or res.status_code == 404


def test_cannot_cancel_shipped_order(sprint5_setup):
    user = sprint5_setup["user"]
    make_order = sprint5_setup["make_order"]

    order = make_order(user, qty=1)
    order.status = "SHIPPED"
    order.save(update_fields=["status"])

    client = APIClient()
    client.force_authenticate(user=user)

    res = client.post(f"/api/v1/orders/{order.number}/cancel/", format="json")
    assert res.status_code == 409


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
