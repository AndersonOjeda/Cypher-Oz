"""T1 expiry runner. Reported/rejected payments and T2 resolution belong to HU-15."""

import logging

from django.db import transaction
from django.db.models import Q
from django.utils.timezone import now
from rest_framework.exceptions import PermissionDenied

from apps.users.models import User

from .models import Order, OrderStatusHistory, Payment, PaymentStatusHistory
from .services import restore_cancelled_order_inventory

logger = logging.getLogger(__name__)


def require_expiry_actor(actor):
    if not User.objects.filter(pk=actor.pk, role=User.Role.ADMIN, is_active=True).exists():
        raise PermissionDenied("El proceso requiere un administrador activo para auditoría.")


@transaction.atomic
def expire_unpaid_order(actor, number):
    """Serialize with report_payment: lock order, then payment, then inventory.

    The deadline is rechecked after acquiring the locks. Cancellation, its history
    and the inventory reversal either commit together or roll back together.
    Payment stays PENDING: expiration makes no assertion about external funds.
    """
    require_expiry_actor(actor)
    order = Order.objects.select_for_update().get(number=number)
    payment = Payment.objects.select_for_update().get(order=order)
    if (
        order.status != "PENDING"
        or payment.status != "PENDING"
        or now() < payment.report_deadline_at
    ):
        return False
    order.status = "CANCELLED"
    order.save(update_fields=["status"])
    OrderStatusHistory.objects.create(order=order, status="CANCELLED", actor=actor)
    restore_cancelled_order_inventory(actor, order.number, "Vencimiento T1 sin pago reportado")
    return True


def process_unpaid_expirations(actor, *, limit=100, dry_run=False):
    """Bound work and isolate each order's transaction; retry failures next run."""
    require_expiry_actor(actor)
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError("El límite debe estar entre 1 y 1000.")
    numbers = list(
        Order.objects.filter(
            status="PENDING", payment__status="PENDING", payment__report_deadline_at__lte=now()
        )
        .order_by("payment__report_deadline_at", "pk")
        .values_list("number", flat=True)[:limit]
    )
    result = {"candidates": len(numbers), "cancelled": 0, "skipped": 0, "failed": []}
    if dry_run:
        return result
    for number in numbers:
        try:
            if expire_unpaid_order(actor, number):
                result["cancelled"] += 1
            else:
                result["skipped"] += 1
        except Exception:
            # The per-order atomic block has already rolled back. Do not hide failure
            # or prevent other orders in this bounded batch from being processed.
            logger.exception("T1 expiration failed for order %s", number)
            result["failed"].append(str(number))
    return result


@transaction.atomic
def process_payment_deadline(actor, number):
    require_expiry_actor(actor)
    order = Order.objects.select_for_update().get(number=number)
    payment = Payment.objects.select_for_update().get(order=order)
    instant = now()
    if order.status != "PENDING":
        return "skipped"
    if payment.status == "REPORTED":
        if (
            payment.review_deadline_at
            and instant >= payment.review_deadline_at
            and payment.review_alerted_at is None
        ):
            payment.review_alerted_at = instant
            payment.save(update_fields=["review_alerted_at"])
            PaymentStatusHistory.objects.create(
                payment=payment,
                status="REPORTED",
                actor=actor,
                reason=(
                    "Vencimiento T2: revision administrativa urgente; "
                    "no confirma fondos ni cancela el pedido."
                ),
            )
            return "alerted"
        return "skipped"
    if payment.status == "REJECTED":
        if payment.correction_deadline_at is None or instant < payment.correction_deadline_at:
            return "skipped"
        reason = "Vencimiento del plazo de correccion tras rechazo"
    elif payment.status == "PENDING" and instant >= payment.report_deadline_at:
        reason = "Vencimiento T1 sin pago reportado"
    else:
        return "skipped"
    order.status = "CANCELLED"
    order.save(update_fields=["status"])
    OrderStatusHistory.objects.create(order=order, status="CANCELLED", actor=actor)
    restore_cancelled_order_inventory(actor, order.number, reason)
    return "cancelled"


def process_payment_deadlines(actor, *, limit=100, dry_run=False):
    require_expiry_actor(actor)
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError("El limite debe estar entre 1 y 1000.")
    instant = now()
    candidates = list(
        Order.objects.filter(status="PENDING")
        .filter(
            Q(payment__status="PENDING", payment__report_deadline_at__lte=instant)
            | Q(payment__status="REJECTED", payment__correction_deadline_at__lte=instant)
            | Q(
                payment__status="REPORTED",
                payment__review_deadline_at__lte=instant,
                payment__review_alerted_at__isnull=True,
            )
        )
        .order_by("pk")
        .values_list("number", flat=True)[:limit]
    )
    result = {
        "candidates": len(candidates),
        "cancelled": 0,
        "alerted": 0,
        "skipped": 0,
        "failed": [],
    }
    if dry_run:
        return result
    for number in candidates:
        try:
            outcome = process_payment_deadline(actor, number)
            result[outcome] += 1
        except Exception:
            logger.exception("Payment deadline processing failed for order %s", number)
            result["failed"].append(str(number))
    return result
