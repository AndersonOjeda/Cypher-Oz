import hashlib
import json
from datetime import timedelta
from decimal import Decimal

from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.generics import get_object_or_404

from apps.catalog.models import Brand, Category, Product, Variant
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance, StockMovement
from apps.promotions.models import Promotion, PromotionVariant
from apps.users.models import Address, User

from .models import (
    Order,
    OrderDelivery,
    OrderItem,
    OrderStatusHistory,
    Payment,
    PaymentStatusHistory,
)


class CheckoutConflict(APIException):
    status_code = 409
    default_code = "CHECKOUT_CHANGED"
    default_detail = "La compra cambió. Revisa nuevamente los datos y el total."


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def money(value):
    return format(value, ".2f")


def quote_locked(user, data):
    """Lock in a stable order compatible with catalogue edits and stock operations."""
    ids = [line["variant_id"] for line in data["items"]]
    product_ids = Variant.objects.filter(pk__in=ids).values_list("product_id", flat=True)
    products = list(Product.objects.select_for_update().filter(pk__in=product_ids).order_by("pk"))
    list(
        Category.objects.select_for_update()
        .filter(pk__in=[p.category_id for p in products])
        .order_by("pk")
    )
    list(
        Brand.objects.select_for_update()
        .filter(pk__in=[p.brand_id for p in products])
        .order_by("pk")
    )
    # Administrative movements lock the balance before inserting a variant FK.
    # NO KEY UPDATE keeps price edits serialized without blocking that FK check.
    list(Variant.objects.select_for_update(no_key=True).filter(pk__in=ids).order_by("pk"))
    variants = {
        v.pk: v
        for v in Variant.objects.select_related("product__category", "product__brand").filter(
            pk__in=ids
        )
    }
    balances = {
        b.variant_id: b
        for b in InventoryBalance.objects.select_for_update()
        .filter(variant_id__in=ids)
        .order_by("variant_id")
    }
    settings = dict(
        StoreSetting.objects.select_for_update().order_by("key").values_list("key", "value")
    )
    now = timezone.now()
    # Ambiguous overlapping offers block checkout; discounts never stack silently.
    offers = {}
    promotion_ids = PromotionVariant.objects.filter(variant_id__in=ids).values_list(
        "promotion_id", flat=True
    )
    promotions = {
        p.pk: p
        for p in Promotion.objects.select_for_update().filter(pk__in=promotion_ids).order_by("pk")
    }
    for price in (
        PromotionVariant.objects.select_for_update().filter(variant_id__in=ids).order_by("pk")
    ):
        promotion = promotions.get(price.promotion_id)
        if promotion and promotion.is_active and promotion.starts_at <= now < promotion.ends_at:
            if price.variant_id in offers:
                raise CheckoutConflict(
                    "Hay promociones superpuestas. La tienda debe revisar la oferta."
                )
            offers[price.variant_id] = (promotion, price.price)
    lines = []
    for item in data["items"]:
        variant = variants.get(item["variant_id"])
        if variant is None or not variant.catalog_available:
            raise CheckoutConflict("Una variante ya no está disponible. Retírala de la compra.")
        balance = balances.get(variant.pk)
        if balance is None or balance.available_quantity < item["quantity"]:
            raise CheckoutConflict(
                f"Stock insuficiente para {variant.product.name} ({variant.sku})."
            )
        discount = Decimal("0")
        promotion_snapshot = {}
        if variant.pk in offers:
            promotion, promotion_price = offers[variant.pk]
            if promotion_price < variant.price:
                discount = (variant.price - promotion_price) * item["quantity"]
                promotion_snapshot = {
                    "id": promotion.pk,
                    "name": promotion.name,
                    "price": money(promotion_price),
                }
        lines.append(
            {
                **item,
                "product_name": variant.product.name,
                "variant_name": variant.name,
                "sku": variant.sku,
                "unit_price": money(variant.price),
                "discount": money(discount),
                "total": money(variant.price * item["quantity"] - discount),
                "promotion": promotion_snapshot,
            }
        )
    address = {}
    if data["delivery_mode"] != "PICKUP":
        row = get_object_or_404(Address, pk=data["address_id"], user=user)
        address = {
            key: getattr(row, key)
            for key in ["recipient_name", "phone", "address_line", "city", "state", "notes"]
        }
    subtotal = sum((Decimal(line["unit_price"]) * line["quantity"] for line in lines), Decimal("0"))
    discount_total = sum((Decimal(line["discount"]) for line in lines), Decimal("0"))
    net = subtotal - discount_total
    special = data["delivery_mode"] == "SPECIAL" or (
        data["delivery_mode"] == "URBAN" and address["city"].strip().casefold() != "pasto"
    )
    shipping = None if special else Decimal("0")
    if (
        not special
        and data["delivery_mode"] == "URBAN"
        and net < Decimal(settings["free_shipping_threshold"])
    ):
        shipping = Decimal(settings["urban_flat_shipping_rate"])
    quote = {
        "items": lines,
        "delivery_mode": data["delivery_mode"],
        "address": address,
        "subtotal": money(subtotal),
        "discount": money(discount_total),
        "shipping": None if shipping is None else money(shipping),
        "total": None if shipping is None else money(net + shipping),
        "currency": "COP",
        "can_confirm": not special,
        "message": "Tarifa especial por confirmar. No es posible crear el pedido todavía."
        if special
        else "",
    }
    return quote, balances, settings


@transaction.atomic
def preview(user, data):
    User.objects.select_for_update(no_key=True).get(pk=user.pk)
    quote, _, _ = quote_locked(user, data)
    return {
        **quote,
        "quote_token": signing.dumps({"user": user.pk, "hash": digest(quote)}, salt="checkout"),
    }


@transaction.atomic
def create_order(user, data, key):
    if (
        not isinstance(key, str)
        or not 8 <= len(key) <= 100
        or not key.isascii()
        or not key.isprintable()
    ):
        raise ValidationError({"Idempotency-Key": "Usa una clave de 8 a 100 caracteres ASCII."})
    User.objects.select_for_update(no_key=True).get(pk=user.pk)
    request_hash = digest(data)
    existing = Order.objects.filter(user=user, idempotency_key=key).first()
    if existing:
        if existing.request_hash != request_hash:
            raise CheckoutConflict("Esta clave ya corresponde a otra compra. Consulta tus pedidos.")
        return existing, False
    quote, balances, settings = quote_locked(user, data)
    try:
        expected = signing.loads(data["quote_token"], salt="checkout", max_age=900)
    except signing.BadSignature as exc:
        raise CheckoutConflict("La revisión venció. Revisa nuevamente antes de confirmar.") from exc
    if expected != {"user": user.pk, "hash": digest(quote)}:
        raise CheckoutConflict()
    if not quote["can_confirm"]:
        raise CheckoutConflict(quote["message"])
    try:
        deadline = timezone.now() + timedelta(hours=settings["unpaid_order_timeout_hours"])
    except (OverflowError, TypeError) as exc:
        raise ValidationError("El plazo de pago configurado no es válido.") from exc
    order = Order.objects.create(
        user=user,
        idempotency_key=key,
        request_hash=request_hash,
        **{k: quote[k] for k in ["subtotal", "discount", "shipping", "total"]},
    )
    for line in quote["items"]:
        balance = balances[line["variant_id"]]
        previous = balance.available_quantity
        balance.available_quantity -= line["quantity"]
        balance.save(update_fields=["available_quantity", "updated_at"])
        movement = StockMovement.objects.create(
            variant_id=line["variant_id"],
            sku=line["sku"],
            type="SALE",
            quantity=-line["quantity"],
            previous_quantity=previous,
            resulting_quantity=balance.available_quantity,
            reason=f"Pedido {order.number}",
            actor=user,
        )
        OrderItem.objects.create(order=order, movement=movement, **line)
    OrderDelivery.objects.create(
        order=order, mode=quote["delivery_mode"], address=quote["address"], cost=quote["shipping"]
    )
    payment = Payment.objects.create(order=order, report_deadline_at=deadline)
    PaymentStatusHistory.objects.create(payment=payment, status="PENDING", actor=user)
    OrderStatusHistory.objects.create(order=order, status="PENDING", actor=user)
    return order, True


@transaction.atomic
def report_payment(user, number, reference):
    order = get_object_or_404(Order.objects.select_for_update(), number=number, user=user)
    payment = Payment.objects.select_for_update().get(order=order)
    if payment.status == "REPORTED":
        if payment.reference == reference:
            return payment
        raise CheckoutConflict("El pago ya tiene una referencia reportada. Contacta con la tienda.")
    if order.status != "PENDING" or payment.status != "PENDING":
        raise CheckoutConflict("El estado actual no permite reportar este pago.")
    setting = StoreSetting.objects.select_for_update().get(key="reported_payment_timeout_hours")
    now = timezone.now()
    if now >= payment.report_deadline_at:
        raise CheckoutConflict("El plazo para reportar el pago venció. Contacta con la tienda.")
    hours = setting.value
    if type(hours) is not int or hours <= 0:
        raise ValidationError({"configuration": "El plazo de revisión configurado no es válido."})
    try:
        deadline = now + timedelta(hours=hours)
    except OverflowError as exc:
        raise ValidationError(
            {"configuration": "El plazo de revisión es demasiado grande."}
        ) from exc
    payment.status = "REPORTED"
    payment.reference = reference
    payment.reported_at = now
    payment.review_deadline_at = deadline
    # Keep T1 for audit; it only applies while the payment is PENDING.
    payment.save(update_fields=["status", "reference", "reported_at", "review_deadline_at"])
    PaymentStatusHistory.objects.create(payment=payment, status="REPORTED", actor=user)
    return payment
