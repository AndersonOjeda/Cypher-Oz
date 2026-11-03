from django.conf import settings
from django.db import models


class ProductReview(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="product_reviews"
    )
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="reviews")
    order_item = models.ForeignKey(
        "orders.OrderItem", on_delete=models.PROTECT, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.CharField(max_length=1000)
    visibility = models.CharField(max_length=10, default="VISIBLE")
    edit_count = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_reviews"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="review_user_product_unique"),
            models.CheckConstraint(
                condition=models.Q(rating__gte=1, rating__lte=5),
                name="review_rating_valid_range",
            ),
            models.CheckConstraint(
                condition=~models.Q(comment=""), name="review_comment_not_empty"
            ),
            models.CheckConstraint(
                condition=models.Q(visibility__in=["VISIBLE", "HIDDEN"]),
                name="review_visibility_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["product", "visibility", "-created_at", "-id"],
                name="review_prod_vis_created_idx",
            ),
        ]


class ReviewEditHistory(models.Model):
    review = models.ForeignKey(ProductReview, on_delete=models.PROTECT, related_name="edit_history")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    previous_rating = models.PositiveSmallIntegerField()
    new_rating = models.PositiveSmallIntegerField()
    previous_comment = models.CharField(max_length=1000)
    new_comment = models.CharField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "review_edit_history"
        ordering = ["-created_at", "-id"]


class ReviewReport(models.Model):
    review = models.ForeignKey(ProductReview, on_delete=models.PROTECT, related_name="reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="review_reports"
    )
    reason = models.CharField(max_length=300)
    status = models.CharField(max_length=20, default="OPEN")
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="resolved_review_reports",
    )
    resolution_reason = models.CharField(max_length=300, blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "review_reports"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["review", "reporter"],
                condition=models.Q(status="OPEN"),
                name="review_report_one_open_per_user",
            ),
            models.CheckConstraint(
                condition=~models.Q(reason=""), name="review_report_reason_not_empty"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=[
                        "OPEN",
                        "DISMISSED",
                        "RESOLVED_HIDDEN",
                        "RESOLVED_RESTORED",
                    ]
                ),
                name="review_report_valid_status",
            ),
        ]


class ReviewModerationLog(models.Model):
    review = models.ForeignKey(
        ProductReview, on_delete=models.PROTECT, related_name="moderation_logs"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="review_moderation_actions",
    )
    action = models.CharField(max_length=20)
    reason = models.CharField(max_length=300)
    previous_visibility = models.CharField(max_length=10)
    new_visibility = models.CharField(max_length=10)
    snapshot_rating = models.PositiveSmallIntegerField()
    snapshot_comment = models.CharField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "review_moderation_logs"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(reason=""), name="review_mod_reason_not_empty"
            ),
            models.CheckConstraint(
                condition=models.Q(action__in=["HIDE", "RESTORE", "DISMISS_REPORTS"]),
                name="review_mod_valid_action",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    previous_visibility__in=["VISIBLE", "HIDDEN"],
                    new_visibility__in=["VISIBLE", "HIDDEN"],
                ),
                name="review_mod_valid_visibility",
            ),
        ]
