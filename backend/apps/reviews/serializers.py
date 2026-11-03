from rest_framework import serializers

from apps.orders.serializers import IntegerField, StrictSerializer


def clean_plain_text(value: str, min_len: int, max_len: int, field_label: str) -> str:
    if not isinstance(value, str):
        raise serializers.ValidationError(f"{field_label} inválido.")
    normalized = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(normalized) < min_len:
        if min_len == 1:
            raise serializers.ValidationError(f"{field_label} no puede estar vacío.")
        raise serializers.ValidationError(
            f"{field_label} debe tener al menos {min_len} caracteres."
        )
    if len(normalized) > max_len:
        raise serializers.ValidationError(
            f"{field_label} no puede superar {max_len} caracteres."
        )
    if any(not (ch.isprintable() or ch in ("\n", "\t")) for ch in normalized):
        raise serializers.ValidationError(
            f"{field_label} contiene caracteres de control no permitidos."
        )
    return normalized


def reduce_public_author_name(full_name: str) -> str:
    cleaned = " ".join((full_name or "").strip().split())
    if not cleaned:
        return "Cliente verificado"
    parts = cleaned.split(" ")
    first = parts[0]
    if len(parts) > 1 and parts[1]:
        return f"{first} {parts[1][0].upper()}."
    return first


class ReviewCreateSerializer(StrictSerializer):
    order_item_id = IntegerField(min_value=1, required=False)
    order_number = serializers.UUIDField(required=False)
    variant_id = IntegerField(min_value=1, required=False)
    rating = IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(
        max_length=2000, trim_whitespace=False, allow_blank=True
    )

    def validate_comment(self, value):
        return clean_plain_text(value, 1, 1000, "El comentario")

    def validate(self, attrs):
        has_item_id = attrs.get("order_item_id") is not None
        has_order_variant = (
            attrs.get("order_number") is not None and attrs.get("variant_id") is not None
        )
        if not has_item_id and not has_order_variant:
            raise serializers.ValidationError(
                {
                    "order_item_id": [
                        "Debes indicar el ítem del pedido elegible para reseñar."
                    ]
                }
            )
        return attrs


class ReviewUpdateSerializer(StrictSerializer):
    rating = IntegerField(min_value=1, max_value=5, required=False)
    comment = serializers.CharField(
        max_length=2000, trim_whitespace=False, allow_blank=True, required=False
    )

    def validate_comment(self, value):
        return clean_plain_text(value, 1, 1000, "El comentario")

    def validate(self, attrs):
        if "rating" not in attrs and "comment" not in attrs:
            raise serializers.ValidationError(
                {"non_field_errors": ["Debes enviar la calificación o el comentario."]}
            )
        return attrs


class ReviewReportCreateSerializer(StrictSerializer):
    reason = serializers.CharField(
        max_length=500, trim_whitespace=False, allow_blank=True
    )

    def validate_reason(self, value):
        return clean_plain_text(value, 3, 300, "El motivo del reporte")


class ReviewModerateSerializer(StrictSerializer):
    action = serializers.ChoiceField(
        choices=["HIDE", "RESTORE", "DISMISS_REPORTS"]
    )
    reason = serializers.CharField(
        max_length=500, trim_whitespace=False, allow_blank=True
    )

    def validate_reason(self, value):
        return clean_plain_text(value, 3, 300, "El motivo de moderación")


def serialize_public_review(review):
    verified = True
    return {
        "id": review.id,
        "product_id": review.product_id,
        "rating": review.rating,
        "comment": review.comment,
        "author_name": reduce_public_author_name(review.user.name),
        "verified_purchase": verified,
        "verified_label": "Compra verificada" if verified else "",
        "is_edited": review.edited_at is not None,
        "edited_at": review.edited_at.isoformat() if review.edited_at else None,
        "created_at": review.created_at.isoformat(),
    }


def serialize_customer_review(review):
    data = serialize_public_review(review)
    data["visibility"] = review.visibility
    data["edit_count"] = review.edit_count
    return data


def serialize_admin_report(report):
    return {
        "id": report.id,
        "review_id": report.review_id,
        "reporter_name": report.reporter.name,
        "reporter_email": report.reporter.email,
        "reason": report.reason,
        "status": report.status,
        "resolved_by_email": report.resolved_by.email if report.resolved_by else None,
        "resolution_reason": report.resolution_reason,
        "resolved_at": report.resolved_at.isoformat() if report.resolved_at else None,
        "created_at": report.created_at.isoformat(),
    }


def serialize_admin_moderation_log(log):
    return {
        "id": log.id,
        "action": log.action,
        "reason": log.reason,
        "actor_email": log.actor.email,
        "previous_visibility": log.previous_visibility,
        "new_visibility": log.new_visibility,
        "snapshot_rating": log.snapshot_rating,
        "snapshot_comment": log.snapshot_comment,
        "created_at": log.created_at.isoformat(),
    }


def serialize_admin_review(review):
    reports = list(review.reports.all())
    open_reports = [r for r in reports if r.status == "OPEN"]
    return {
        "id": review.id,
        "product_id": review.product_id,
        "product_name": review.product.name,
        "product_slug": review.product.slug,
        "author_name": review.user.name,
        "variant_name": review.order_item.variant_name,
        "sku": review.order_item.sku,
        "rating": review.rating,
        "comment": review.comment,
        "visibility": review.visibility,
        "verified_purchase": True,
        "edit_count": review.edit_count,
        "is_edited": review.edited_at is not None,
        "edited_at": review.edited_at.isoformat() if review.edited_at else None,
        "created_at": review.created_at.isoformat(),
        "open_reports_count": len(open_reports),
        "total_reports_count": len(reports),
        "reports": [serialize_admin_report(r) for r in reports],
        "moderation_logs": [
            serialize_admin_moderation_log(log) for log in review.moderation_logs.all()
        ],
    }
