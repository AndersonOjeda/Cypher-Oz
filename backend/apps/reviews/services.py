from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied

from apps.catalog.models import Product
from apps.orders.models import OrderItem
from apps.users.models import User

from .models import (
    ProductReview,
    ReviewEditHistory,
    ReviewModerationLog,
    ReviewReport,
)


class ReviewAlreadyExistsConflict(APIException):
    status_code = 409
    default_code = "REVIEW_ALREADY_EXISTS"
    default_detail = (
        "Ya publicaste una reseña para este producto. Puedes editar tu reseña existente."
    )


class ReportAlreadyActiveConflict(APIException):
    status_code = 409
    default_code = "REPORT_ALREADY_ACTIVE"
    default_detail = "Ya tienes un reporte activo en revisión para esta reseña."


def format_rating_one_decimal(avg_val):
    if avg_val is None:
        return None, None
    rounded = Decimal(str(avg_val)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return float(rounded), str(rounded).replace(".", ",")


def get_product_reviews_summary(product_id: int) -> dict:
    agg = ProductReview.objects.filter(product_id=product_id, visibility="VISIBLE").aggregate(
        review_count=Count("id"),
        average_rating=Avg("rating"),
        stars_5=Count("id", filter=Q(rating=5)),
        stars_4=Count("id", filter=Q(rating=4)),
        stars_3=Count("id", filter=Q(rating=3)),
        stars_2=Count("id", filter=Q(rating=2)),
        stars_1=Count("id", filter=Q(rating=1)),
    )
    count = agg["review_count"] or 0
    if count == 0:
        return {
            "average_rating": None,
            "average_rating_display": None,
            "review_count": 0,
            "empty_message": "Este producto aún no tiene reseñas",
            "distribution": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0},
        }
    avg_num, avg_display = format_rating_one_decimal(agg["average_rating"])
    return {
        "average_rating": avg_num,
        "average_rating_display": avg_display,
        "review_count": count,
        "empty_message": None,
        "distribution": {
            "5": agg["stars_5"] or 0,
            "4": agg["stars_4"] or 0,
            "3": agg["stars_3"] or 0,
            "2": agg["stars_2"] or 0,
            "1": agg["stars_1"] or 0,
        },
    }


def get_products_reviews_summaries(product_ids: list[int]) -> dict[int, dict]:
    if not product_ids:
        return {}
    rows = (
        ProductReview.objects.filter(product_id__in=product_ids, visibility="VISIBLE")
        .values("product_id")
        .annotate(
            review_count=Count("id"),
            average_rating=Avg("rating"),
        )
    )
    by_product = {}
    for row in rows:
        count = row["review_count"] or 0
        if count > 0:
            avg_num, avg_display = format_rating_one_decimal(row["average_rating"])
            by_product[row["product_id"]] = {
                "average_rating": avg_num,
                "average_rating_display": avg_display,
                "review_count": count,
            }
    return {
        pid: by_product.get(
            pid,
            {
                "average_rating": None,
                "average_rating_display": None,
                "review_count": 0,
            },
        )
        for pid in product_ids
    }


def create_verified_review(user, validated_data):
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)

        order_item_id = validated_data.get("order_item_id")
        if order_item_id is not None:
            order_item = (
                OrderItem.objects.select_related("order__payment", "variant__product")
                .filter(pk=order_item_id)
                .first()
            )
        else:
            order_item = (
                OrderItem.objects.select_related("order__payment", "variant__product")
                .filter(
                    order__number=validated_data["order_number"],
                    variant_id=validated_data["variant_id"],
                )
                .first()
            )

        if order_item is None or order_item.order.user_id != user.id:
            raise PermissionDenied("El pedido o producto indicado no pertenece a tus compras.")

        payment = getattr(order_item.order, "payment", None)
        if (
            order_item.order.status != "DELIVERED"
            or payment is None
            or payment.status != "CONFIRMED"
        ):
            raise PermissionDenied(
                "Solo puedes calificar productos de pedidos propios entregados "
                "y con pago confirmado."
            )

        product_id = order_item.variant.product_id
        Product.objects.select_for_update().get(pk=product_id)

        existing = (
            ProductReview.objects.select_for_update(of=("self",))
            .select_related("user", "order_item__order__payment")
            .filter(user=user, product_id=product_id)
            .first()
        )
        if existing is not None:
            raise ReviewAlreadyExistsConflict(
                detail={
                    "detail": (
                        "Ya publicaste una reseña para este producto. "
                        "Puedes editar tu reseña existente."
                    ),
                    "review_id": existing.id,
                }
            )

        try:
            review = ProductReview.objects.create(
                user=user,
                product_id=product_id,
                order_item=order_item,
                rating=validated_data["rating"],
                comment=validated_data["comment"],
                visibility="VISIBLE",
            )
        except IntegrityError as exc:
            raise ReviewAlreadyExistsConflict() from exc

        return ProductReview.objects.select_related("user", "order_item__order__payment").get(
            pk=review.pk
        )


def update_own_review(user, review_id: int, validated_data):
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        review = (
            ProductReview.objects.select_for_update(of=("self",))
            .select_related("user", "product", "order_item__order__payment")
            .filter(pk=review_id)
            .first()
        )
        if review is None:
            raise NotFound("Reseña no encontrada.")
        if review.user_id != user.id:
            raise PermissionDenied("Solo el autor puede editar su reseña.")

        new_rating = validated_data.get("rating", review.rating)
        new_comment = validated_data.get("comment", review.comment)

        if new_rating != review.rating or new_comment != review.comment:
            ReviewEditHistory.objects.create(
                review=review,
                actor=user,
                previous_rating=review.rating,
                new_rating=new_rating,
                previous_comment=review.comment,
                new_comment=new_comment,
            )
            review.rating = new_rating
            review.comment = new_comment
            review.edit_count += 1
            review.edited_at = timezone.now()
            review.save(
                update_fields=[
                    "rating",
                    "comment",
                    "edit_count",
                    "edited_at",
                    "updated_at",
                ]
            )

        return review


def report_review(user, review_id: int, reason: str):
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        review = (
            ProductReview.objects.select_for_update()
            .filter(pk=review_id, visibility="VISIBLE")
            .first()
        )
        if review is None:
            raise NotFound("Reseña no encontrada o no disponible.")

        existing_open = (
            ReviewReport.objects.select_for_update()
            .filter(review=review, reporter=user, status="OPEN")
            .first()
        )
        if existing_open is not None:
            raise ReportAlreadyActiveConflict(
                detail={
                    "detail": "Ya tienes un reporte activo en revisión para esta reseña.",
                    "report_id": existing_open.id,
                }
            )

        try:
            report = ReviewReport.objects.create(
                review=review,
                reporter=user,
                reason=reason,
                status="OPEN",
            )
        except IntegrityError as exc:
            raise ReportAlreadyActiveConflict() from exc

        return report


def moderate_review(admin_user, review_id: int, action: str, reason: str):
    with transaction.atomic():
        review = (
            ProductReview.objects.select_for_update(of=("self",))
            .select_related("user", "product", "order_item__order__payment")
            .filter(pk=review_id)
            .first()
        )
        if review is None:
            raise NotFound("Reseña no encontrada.")

        prev_visibility = review.visibility
        now = timezone.now()
        open_reports_qs = ReviewReport.objects.select_for_update().filter(
            review=review, status="OPEN"
        )
        has_open_reports = open_reports_qs.exists()

        if action == "HIDE":
            if prev_visibility == "HIDDEN" and not has_open_reports:
                return (
                    ProductReview.objects.select_related(
                        "user", "product", "order_item__order__payment"
                    )
                    .prefetch_related(
                        "reports__reporter",
                        "reports__resolved_by",
                        "moderation_logs__actor",
                    )
                    .get(pk=review.pk)
                )
            review.visibility = "HIDDEN"
            review.save(update_fields=["visibility", "updated_at"])
            open_reports_qs.update(
                status="RESOLVED_HIDDEN",
                resolved_by=admin_user,
                resolution_reason=reason,
                resolved_at=now,
            )
            ReviewModerationLog.objects.create(
                review=review,
                actor=admin_user,
                action="HIDE",
                reason=reason,
                previous_visibility=prev_visibility,
                new_visibility="HIDDEN",
                snapshot_rating=review.rating,
                snapshot_comment=review.comment,
            )
        elif action == "RESTORE":
            if prev_visibility == "VISIBLE" and not has_open_reports:
                return (
                    ProductReview.objects.select_related(
                        "user", "product", "order_item__order__payment"
                    )
                    .prefetch_related(
                        "reports__reporter",
                        "reports__resolved_by",
                        "moderation_logs__actor",
                    )
                    .get(pk=review.pk)
                )
            review.visibility = "VISIBLE"
            review.save(update_fields=["visibility", "updated_at"])
            open_reports_qs.update(
                status="RESOLVED_RESTORED",
                resolved_by=admin_user,
                resolution_reason=reason,
                resolved_at=now,
            )
            ReviewModerationLog.objects.create(
                review=review,
                actor=admin_user,
                action="RESTORE",
                reason=reason,
                previous_visibility=prev_visibility,
                new_visibility="VISIBLE",
                snapshot_rating=review.rating,
                snapshot_comment=review.comment,
            )
        elif action == "DISMISS_REPORTS":
            if not has_open_reports:
                return (
                    ProductReview.objects.select_related(
                        "user", "product", "order_item__order__payment"
                    )
                    .prefetch_related(
                        "reports__reporter",
                        "reports__resolved_by",
                        "moderation_logs__actor",
                    )
                    .get(pk=review.pk)
                )
            open_reports_qs.update(
                status="DISMISSED",
                resolved_by=admin_user,
                resolution_reason=reason,
                resolved_at=now,
            )
            ReviewModerationLog.objects.create(
                review=review,
                actor=admin_user,
                action="DISMISS_REPORTS",
                reason=reason,
                previous_visibility=prev_visibility,
                new_visibility=prev_visibility,
                snapshot_rating=review.rating,
                snapshot_comment=review.comment,
            )

        return (
            ProductReview.objects.select_related("user", "product", "order_item__order__payment")
            .prefetch_related(
                "reports__reporter",
                "reports__resolved_by",
                "moderation_logs__actor",
            )
            .get(pk=review.pk)
        )
