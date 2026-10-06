from django.db import transaction
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404

from apps.catalog.models import Variant

from .models import MAX_QUANTITY, InventoryBalance, StockMovement


class InsufficientStock(APIException):
    status_code = 409
    default_code = "INSUFFICIENT_STOCK"
    default_detail = (
        "El ajuste supera las existencias actuales. Consulta el saldo e inténtalo de nuevo."
    )


class StockLimitExceeded(APIException):
    status_code = 409
    default_code = "STOCK_LIMIT_EXCEEDED"
    default_detail = "El saldo resultante supera el límite de almacenamiento permitido."


@transaction.atomic
def record_movement(*, variant_id, quantity, reason, actor, movement_type):
    """The only stock write path. Quantity is a signed delta, never a replacement balance."""
    if not actor.is_authenticated or not actor.is_active or actor.role != "ADMIN":
        raise PermissionDenied()
    if type(variant_id) is not int or variant_id <= 0:
        raise ValidationError({"variant": "Selecciona una variante válida."})
    if type(quantity) is not int or not -MAX_QUANTITY <= quantity <= MAX_QUANTITY or not quantity:
        raise ValidationError({"quantity": "Usa una cantidad entera distinta de cero."})
    if not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 1000:
        raise ValidationError({"reason": "Indica un motivo de 1 a 1000 caracteres."})
    if movement_type not in {StockMovement.Type.ENTRY, StockMovement.Type.ADJUSTMENT}:
        raise ValidationError({"type": "Operación administrativa no permitida."})
    if movement_type == StockMovement.Type.ENTRY and quantity < 0:
        raise ValidationError({"quantity": "Una entrada debe aumentar las existencias."})

    variant = get_object_or_404(Variant, pk=variant_id)
    # Also supports variants created by imports/bulk_create (which do not emit signals).
    InventoryBalance.objects.get_or_create(variant_id=variant.pk)
    balance = InventoryBalance.objects.select_for_update().get(variant_id=variant.pk)
    before = balance.available_quantity
    after = before + quantity
    if after < 0:
        raise InsufficientStock()
    if after > MAX_QUANTITY:
        raise StockLimitExceeded()
    balance.available_quantity = after
    balance.save(update_fields=["available_quantity", "updated_at"])
    return StockMovement.objects.create(
        variant=variant,
        sku=variant.sku,
        type=movement_type,
        quantity=quantity,
        previous_quantity=before,
        resulting_quantity=after,
        reason=reason.strip(),
        actor=actor,
    )
