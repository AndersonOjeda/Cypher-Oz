"""T1 expiry runner. Reported/rejected payments and T2 resolution belong to HU-15."""

import logging

from django.db import transaction
from django.utils.timezone import now
from rest_framework.exceptions import PermissionDenied

from apps.users.models import User

from .models import Order, OrderStatusHistory, Payment
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
