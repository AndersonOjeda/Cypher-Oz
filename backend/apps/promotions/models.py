from django.db import models


class Promotion(models.Model):
    name = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = "promotions"
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")), name="promotion_dates_valid"
            )
        ]


class PromotionVariant(models.Model):
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name="prices")
    variant = models.ForeignKey("catalog.Variant", on_delete=models.PROTECT)
    price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "promotion_variants"
        constraints = [
            models.UniqueConstraint(
                fields=["promotion", "variant"], name="promotion_variant_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(price__gte=0), name="promotion_price_nonnegative"
            ),
        ]
