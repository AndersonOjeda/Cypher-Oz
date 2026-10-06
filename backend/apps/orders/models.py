import uuid

from django.conf import settings
from django.db import models


class Order(models.Model):
    number = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    idempotency_key = models.CharField(max_length=100)
    request_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=20, default="PENDING")
    subtotal = models.DecimalField(max_digits=18, decimal_places=2)
    discount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=18, decimal_places=2)
    total = models.DecimalField(max_digits=18, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "idempotency_key"], name="order_user_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=0, discount__gte=0, shipping__gte=0, total__gte=0),
                name="order_amounts_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    total=models.F("subtotal") - models.F("discount") + models.F("shipping")
                ),
                name="order_total_matches",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"]
                ),
                name="order_valid_status",
            ),
        ]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="items")
    variant = models.ForeignKey("catalog.Variant", on_delete=models.PROTECT)
    product_name = models.CharField(max_length=180)
    variant_name = models.CharField(max_length=120)
    sku = models.CharField(max_length=80)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=18, decimal_places=2)
    promotion = models.JSONField(default=dict)
    movement = models.OneToOneField("inventory.StockMovement", on_delete=models.PROTECT)

    class Meta:
        db_table = "order_items"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["order", "variant"], name="order_variant_unique"),
            models.CheckConstraint(
                condition=models.Q(
                    quantity__gt=0, unit_price__gte=0, discount__gte=0, total__gte=0
                ),
                name="order_item_values_valid",
            ),
        ]


class OrderDelivery(models.Model):
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="delivery")
    mode = models.CharField(max_length=10)
    address = models.JSONField(default=dict)
    cost = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table = "order_deliveries"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cost__gte=0), name="delivery_cost_nonnegative"
            ),
            models.CheckConstraint(
                condition=models.Q(mode__in=["PICKUP", "URBAN", "SPECIAL"]),
                name="delivery_mode_valid",
            ),
        ]


class Payment(models.Model):
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="payment")
    status = models.CharField(max_length=20, default="PENDING")
    report_deadline_at = models.DateTimeField()
    review_deadline_at = models.DateTimeField(null=True)
    reference = models.CharField(max_length=120, blank=True, default="")
    reported_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "payments"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=["PENDING", "REPORTED", "CONFIRMED", "REJECTED"]),
                name="payment_valid_status",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="REPORTED")
                | (
                    models.Q(reported_at__isnull=False, review_deadline_at__isnull=False)
                    & models.Q(review_deadline_at__gt=models.F("reported_at"))
                    & ~models.Q(reference="")
                ),
                name="reported_payment_has_evidence_and_deadline",
            ),
        ]


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="history")
    status = models.CharField(max_length=20)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "order_status_history"


class PaymentStatusHistory(models.Model):
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="history")
    status = models.CharField(max_length=20)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_status_history"
