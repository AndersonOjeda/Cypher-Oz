import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import (
    Brand,
    Category,
    CategoryAttribute,
    Product,
    Variant,
    VariantAttributeValue,
)
from apps.inventory.models import InventoryBalance, StockMovement
from apps.orders.models import Order, OrderDelivery, OrderItem, Payment
from apps.users.models import User


@pytest.fixture
def sprint7_setup(db):
    client = User.objects.create_user(
        email="sprint7_client@test.com", password="Password123!", name="Cliente Sprint 7"
    )
    admin = User.objects.create_superuser(
        email="sprint7_admin@test.com", password="Password123!", name="Admin Sprint 7"
    )

    # Categories
    cat_monitors = Category.objects.create(name="Monitores", slug="monitores", is_active=True)
    cat_audio = Category.objects.create(name="Audio", slug="audio", is_active=True)

    # Category Attributes for Monitors
    attr_res = CategoryAttribute.objects.create(
        category=cat_monitors, code="resolucion", name="Resolución"
    )
    attr_hz = CategoryAttribute.objects.create(
        category=cat_monitors, code="tasa_refresco", name="Tasa de Refresco"
    )

    brand_lg = Brand.objects.create(name="LG", slug="lg", is_active=True)
    brand_samsung = Brand.objects.create(name="Samsung", slug="samsung", is_active=True)
    brand_sony = Brand.objects.create(name="Sony", slug="sony", is_active=True)

    # Product 1: LG Ultragear
    prod_lg = Product.objects.create(
        name="LG UltraGear 27",
        slug="lg-ultragear-27",
        category=cat_monitors,
        brand=brand_lg,
        description="Monitor gamer IPS 144Hz 1ms",
        warranty="3 años con fabricante",
        is_active=True,
    )
    var_lg = Variant.objects.create(
        product=prod_lg,
        name="27 Pulgadas QHD",
        sku="LG-27GP850",
        price=Decimal("1450000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=var_lg).update(available_quantity=15)
    VariantAttributeValue.objects.create(variant=var_lg, attribute=attr_res, value="2560x1440 QHD")
    VariantAttributeValue.objects.create(variant=var_lg, attribute=attr_hz, value="165 Hz")

    # Product 2: Samsung Odyssey
    prod_samsung = Product.objects.create(
        name="Samsung Odyssey G5",
        slug="samsung-odyssey-g5",
        category=cat_monitors,
        brand=brand_samsung,
        description="Monitor curvo gamer 144Hz",
        warranty="2 años con fabricante",
        is_active=True,
    )
    var_samsung = Variant.objects.create(
        product=prod_samsung,
        name="27 Pulgadas Curvo",
        sku="SAM-G5-27",
        price=Decimal("1200000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=var_samsung).update(available_quantity=10)
    VariantAttributeValue.objects.create(
        variant=var_samsung, attribute=attr_res, value="2560x1440 QHD"
    )
    VariantAttributeValue.objects.create(variant=var_samsung, attribute=attr_hz, value="144 Hz")

    # Product 3: Monitor inactivo
    prod_inactive = Product.objects.create(
        name="Monitor Antiguo Inactivo",
        slug="monitor-antiguo",
        category=cat_monitors,
        brand=brand_lg,
        description="Modelo descatalogado",
        warranty="",
        is_active=False,
    )

    # Product 4: Incompatible Category (Audio)
    prod_audio = Product.objects.create(
        name="Sony WH-1000XM5",
        slug="sony-wh-1000xm5",
        category=cat_audio,
        brand=brand_sony,
        description="Auriculares inalámbricos con cancelación de ruido",
        warranty="1 año",
        is_active=True,
    )
    var_audio = Variant.objects.create(
        product=prod_audio,
        name="Negro",
        sku="SONY-XM5-BLK",
        price=Decimal("1600000.00"),
        is_active=True,
    )
    InventoryBalance.objects.filter(variant=var_audio).update(available_quantity=8)

    # Helper to create orders with different delivery modes
    def make_order(order_user, mode="URBAN", status="PENDING"):
        now = timezone.now()
        balance = InventoryBalance.objects.get(variant=var_lg)
        prev_qty = balance.available_quantity
        balance.available_quantity -= 1
        balance.save(update_fields=["available_quantity", "updated_at"])

        sale_movement = StockMovement.objects.create(
            variant=var_lg,
            sku=var_lg.sku,
            type="SALE",
            quantity=-1,
            previous_quantity=prev_qty,
            resulting_quantity=balance.available_quantity,
            reason="Venta Sprint 7 test",
            actor=order_user,
        )

        shipping = Decimal("5000.00") if mode == "URBAN" else Decimal("0.00")
        subtotal = Decimal("1450000.00")
        total = subtotal + shipping

        order = Order.objects.create(
            user=order_user,
            number=uuid.uuid4(),
            idempotency_key=str(uuid.uuid4()),
            status=status,
            subtotal=subtotal,
            discount=Decimal("0.00"),
            shipping=shipping,
            total=total,
        )
        OrderItem.objects.create(
            order=order,
            variant=var_lg,
            product_name=prod_lg.name,
            variant_name=var_lg.name,
            sku=var_lg.sku,
            quantity=1,
            unit_price=var_lg.price,
            discount=Decimal("0.00"),
            total=subtotal,
            movement=sale_movement,
        )
        OrderDelivery.objects.create(
            order=order,
            mode=mode,
            address={
                "recipient_name": "Carlos Gomez",
                "address_line": "Calle 18 # 24-30",
                "city": "Pasto",
                "state": "Nariño",
                "phone": "3105551234",
                "notes": "Entregar en portería torre A",
            }
            if mode != "PICKUP"
            else {},
            cost=shipping,
        )
        Payment.objects.create(
            order=order,
            status="PENDING",
            report_deadline_at=now + timedelta(hours=24),
        )
        return order

    return {
        "client": client,
        "admin": admin,
        "cat_monitors": cat_monitors,
        "cat_audio": cat_audio,
        "prod_lg": prod_lg,
        "prod_samsung": prod_samsung,
        "prod_inactive": prod_inactive,
        "prod_audio": prod_audio,
        "make_order": make_order,
    }


# =========================================================================
# HU-29 (CO-71) TESTS: Gestión Administrativa de Entrega
# =========================================================================

def test_admin_order_list_filters_by_delivery_mode(sprint7_setup):
    setup = sprint7_setup
    setup["make_order"](setup["client"], mode="URBAN")
    setup["make_order"](setup["client"], mode="PICKUP")
    setup["make_order"](setup["client"], mode="SPECIAL")

    api = APIClient()
    api.force_authenticate(user=setup["admin"])

    # All
    res_all = api.get("/api/v1/admin/orders/")
    assert res_all.status_code == 200
    assert res_all.data["count"] == 3

    # Filter URBAN
    res_urban = api.get("/api/v1/admin/orders/?delivery_mode=urban")
    assert res_urban.status_code == 200
    assert len(res_urban.data["results"]) == 1
    assert res_urban.data["results"][0]["delivery"]["mode"] == "URBAN"

    # Filter PICKUP
    res_pickup = api.get("/api/v1/admin/orders/?delivery_mode=pickup")
    assert res_pickup.status_code == 200
    assert len(res_pickup.data["results"]) == 1
    assert res_pickup.data["results"][0]["delivery"]["mode"] == "PICKUP"

    # Filter SPECIAL
    res_special = api.get("/api/v1/admin/orders/?delivery_mode=special")
    assert res_special.status_code == 200
    assert len(res_special.data["results"]) == 1
    assert res_special.data["results"][0]["delivery"]["mode"] == "SPECIAL"


def test_admin_order_delivery_details_exposure_and_permissions(sprint7_setup):
    setup = sprint7_setup
    order = setup["make_order"](setup["client"], mode="URBAN")

    # Regular client cannot access admin orders
    client_api = APIClient()
    client_api.force_authenticate(user=setup["client"])
    res_client = client_api.get("/api/v1/admin/orders/")
    assert res_client.status_code == 403

    # Unauthenticated cannot access admin orders
    anon_api = APIClient()
    res_anon = anon_api.get("/api/v1/admin/orders/")
    assert res_anon.status_code == 401

    # Admin access exposes full authorized logistics data
    admin_api = APIClient()
    admin_api.force_authenticate(user=setup["admin"])
    res_admin = admin_api.get(f"/api/v1/admin/orders/{order.number}/")
    assert res_admin.status_code == 200
    delivery = res_admin.data["delivery"]
    assert delivery["mode"] == "URBAN"
    assert delivery["cost"] == "5000.00"
    assert delivery["address"]["recipient_name"] == "Carlos Gomez"
    assert delivery["address"]["city"] == "Pasto"
    assert delivery["address"]["state"] == "Nariño"
    assert delivery["address"]["phone"] == "3105551234"
    assert delivery["address"]["notes"] == "Entregar en portería torre A"


# =========================================================================
# HU-07 (CO-35) TESTS: Comparación de Productos
# =========================================================================

def test_compare_products_limits_validation(sprint7_setup):
    setup = sprint7_setup
    api = APIClient()

    # No params
    res_empty = api.get("/api/v1/products/compare/")
    assert res_empty.status_code == 400
    assert "al menos 2 productos" in res_empty.data["detail"]

    # Less than 2 products (1 ID)
    res_one = api.get(f"/api/v1/products/compare/?ids={setup['prod_lg'].id}")
    assert res_one.status_code == 400
    assert "al menos 2 productos" in res_one.data["detail"]

    # Duplicates that collapse to 1 product
    res_dup = api.get(f"/api/v1/products/compare/?ids={setup['prod_lg'].id},{setup['prod_lg'].id}")
    assert res_dup.status_code == 400
    assert "al menos 2 productos" in res_dup.data["detail"]

    # More than 4 products
    res_too_many = api.get("/api/v1/products/compare/?ids=1,2,3,4,5")
    assert res_too_many.status_code == 400
    assert "hasta 4 productos" in res_too_many.data["detail"]


def test_compare_nonexistent_or_inactive_product(sprint7_setup):
    setup = sprint7_setup
    api = APIClient()

    # Nonexistent product ID
    res_404 = api.get(f"/api/v1/products/compare/?ids={setup['prod_lg'].id},999999")
    assert res_404.status_code == 404
    assert "no existen o no están disponibles" in res_404.data["detail"]

    # Inactive product
    p_lg = setup["prod_lg"].id
    p_inact = setup["prod_inactive"].id
    res_inactive = api.get(f"/api/v1/products/compare/?ids={p_lg},{p_inact}")
    assert res_inactive.status_code == 404
    assert "no existen o no están disponibles" in res_inactive.data["detail"]


def test_compare_incompatible_categories_rejected(sprint7_setup):
    setup = sprint7_setup
    api = APIClient()

    # Compare Monitor (cat_monitors) with Audio (cat_audio)
    res = api.get(f"/api/v1/products/compare/?ids={setup['prod_lg'].id},{setup['prod_audio'].id}")
    assert res.status_code == 400
    assert "misma categoría" in res.data["detail"]


def test_compare_compatible_products_matrix_success(sprint7_setup):
    setup = sprint7_setup
    api = APIClient()

    res = api.get(f"/api/v1/products/compare/?ids={setup['prod_lg'].id},{setup['prod_samsung'].id}")
    assert res.status_code == 200

    data = res.data
    # Category metadata
    assert data["category"]["name"] == "Monitores"
    assert data["category"]["slug"] == "monitores"

    # Category attributes
    attr_codes = [a["code"] for a in data["attributes"]]
    assert "resolucion" in attr_codes
    assert "tasa_refresco" in attr_codes

    # Products matrix
    products = data["products"]
    assert len(products) == 2

    # Product 1
    p1 = products[0]
    assert p1["name"] == "LG UltraGear 27"
    assert p1["brand"]["name"] == "LG"
    assert p1["warranty"] == "3 años con fabricante"
    assert p1["min_price"] == "1450000.00"
    assert p1["is_available"] is True
    assert p1["attributes"]["resolucion"]["value"] == "2560x1440 QHD"
    assert p1["attributes"]["tasa_refresco"]["value"] == "165 Hz"

    # Product 2
    p2 = products[1]
    assert p2["name"] == "Samsung Odyssey G5"
    assert p2["brand"]["name"] == "Samsung"
    assert p2["warranty"] == "2 años con fabricante"
    assert p2["min_price"] == "1200000.00"
    assert p2["is_available"] is True
    assert p2["attributes"]["resolucion"]["value"] == "2560x1440 QHD"
    assert p2["attributes"]["tasa_refresco"]["value"] == "144 Hz"


def test_compare_by_slugs(sprint7_setup):
    setup = sprint7_setup
    api = APIClient()

    s_lg = setup["prod_lg"].slug
    s_sam = setup["prod_samsung"].slug
    res = api.get(f"/api/v1/products/compare/?slugs={s_lg},{s_sam}")
    assert res.status_code == 200
    assert len(res.data["products"]) == 2
    assert res.data["products"][0]["slug"] == "lg-ultragear-27"
    assert res.data["products"][1]["slug"] == "samsung-odyssey-g5"
def test_cannot_confirm_or_reject_payment_on_cancelled_order(sprint7_setup):
    setup = sprint7_setup
    order = setup["make_order"](setup["client"], mode="URBAN", status="CANCELLED")
    payment = order.payment
    now = timezone.now()
    payment.status = "REPORTED"
    payment.reference = "TEST-REF-CANCELLED"
    payment.reported_at = now
    payment.review_deadline_at = now + timedelta(hours=48)
    payment.save()

    api = APIClient()
    api.force_authenticate(user=setup["admin"])

    # Attempt to confirm payment on cancelled order
    res_confirm = api.post(f"/api/v1/admin/payments/{payment.id}/confirm/")
    assert res_confirm.status_code == 409
    assert "cancelado" in str(res_confirm.data).lower()

    # Attempt to reject payment on cancelled order
    res_reject = api.post(
        f"/api/v1/admin/payments/{payment.id}/reject/",
        {"reason": "Comprobante falso"},
        format="json",
    )
    assert res_reject.status_code == 409
    assert "cancelado" in str(res_reject.data).lower()
