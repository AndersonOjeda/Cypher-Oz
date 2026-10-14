from django.conf import settings
from django.db import models

MAX_QUANTITY = 2_147_483_647  # PostgreSQL INTEGER storage limit, not a commercial limit.


class InventoryBalance(models.Model):
    variant = models.OneToOneField(
        "catalog.Variant", on_delete=models.CASCADE, related_name="inventory_balance"
    )
    available_quantity = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_balances"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(available_quantity__gte=0), name="inventory_nonnegative"
            ),
        ]


class StockMovement(models.Model):
    class Type(models.TextChoices):
        ENTRY = "ENTRY", "Entrada"
        SALE = "SALE", "Venta"
        RETURN = "RETURN", "Devolución"
        CANCELLATION = "CANCELLATION", "Cancelación"
        ADJUSTMENT = "ADJUSTMENT", "Ajuste"

    variant = models.ForeignKey(
        "catalog.Variant", on_delete=models.PROTECT, related_name="stock_movements"
    )
    sku = models.CharField(max_length=80)
    type = models.CharField(max_length=12, choices=Type.choices)
    quantity = models.IntegerField()
    previous_quantity = models.IntegerField()
    resulting_quantity = models.IntegerField()
    reason = models.CharField(max_length=1000)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stock_movements"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["variant", "-created_at", "-id"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(previous_quantity__gte=0, resulting_quantity__gte=0),
                name="movement_nonnegative_balances",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    resulting_quantity=models.F("previous_quantity") + models.F("quantity")
                ),
                name="movement_balances_match",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(type__in=["ENTRY", "RETURN", "CANCELLATION"], quantity__gt=0)
                    | models.Q(type="SALE", quantity__lt=0)
                    | (models.Q(type="ADJUSTMENT") & ~models.Q(quantity=0))
                ),
                name="movement_type_and_direction",
            ),
            models.CheckConstraint(
                condition=~models.Q(reason=""), name="movement_reason_not_empty"
            ),
        ]
