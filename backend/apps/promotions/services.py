from django.utils import timezone

from .models import PromotionVariant


def get_active_promotions_for_variants(variant_ids, now=None):
    """
    Returns a dictionary mapping variant_id -> {
        "promotion_id": id,
        "promotion_name": name,
        "promotional_price": Decimal,
    }
    for all variants that have an active, valid promotion whose promotional price is
    strictly lower than the variant's base price.
    """
    if not variant_ids:
        return {}

    if now is None:
        now = timezone.now()

    active_prices = (
        PromotionVariant.objects.filter(
            variant_id__in=variant_ids,
            promotion__is_active=True,
            promotion__starts_at__lte=now,
            promotion__ends_at__gt=now,
        )
        .select_related("promotion", "variant")
        .order_by("pk")
    )

    offers = {}
    for pv in active_prices:
        if pv.price < pv.variant.price:
            # Overlapping offers: retain the first or lowest, but in our model overlapping
            # active offers for the same variant are rejected by validation.
            if pv.variant_id not in offers or pv.price < offers[pv.variant_id]["promotional_price"]:
                offers[pv.variant_id] = {
                    "promotion_id": pv.promotion_id,
                    "promotion_name": pv.promotion.name,
                    "promotional_price": pv.price,
                }

    return offers
