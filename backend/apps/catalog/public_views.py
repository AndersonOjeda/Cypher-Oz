from decimal import Decimal, InvalidOperation

from django.db.models import Exists, OuterRef, Prefetch, Q, Subquery
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.promotions.services import get_active_promotions_for_variants

from .models import Product, Variant, VariantAttributeValue
from .storage import image_url
from .views import CatalogPagination


def format_money(val):
    if val is None:
        return None
    return format(Decimal(str(val)), ".2f")


def serialize_variant(variant, promo_offer=None):
    stock = getattr(getattr(variant, "inventory_balance", None), "available_quantity", 0)
    promo_price = promo_offer["promotional_price"] if promo_offer else None
    promo_name = promo_offer["promotion_name"] if promo_offer else None
    return {
        "id": variant.pk,
        "name": variant.name,
        "sku": variant.sku,
        "price": format_money(variant.price),
        "promotional_price": format_money(promo_price),
        "promotion_name": promo_name,
        "stock": stock,
        "attributes": [
            {
                "code": val.attribute.code,
                "name": val.attribute.name,
                "value": val.value,
            }
            for val in variant.attribute_values.all()
        ],
    }


def serialize_product_summary(product, promo_offers):
    images = list(product.images.all())
    main_image = images[0] if images else None
    active_variants = [v for v in product.variants.all() if v.is_active and v.price >= 0]

    base_prices = [v.price for v in active_variants]
    min_price = min(base_prices) if base_prices else Decimal("0")
    max_price = max(base_prices) if base_prices else Decimal("0")

    promo_prices = []
    has_promotion = False
    for v in active_variants:
        offer = promo_offers.get(v.pk)
        if offer:
            has_promotion = True
            promo_prices.append(offer["promotional_price"])
        else:
            promo_prices.append(v.price)

    promotional_min = min(promo_prices) if promo_prices and has_promotion else None

    total_stock = sum(
        getattr(getattr(v, "inventory_balance", None), "available_quantity", 0)
        for v in active_variants
    )

    return {
        "id": product.pk,
        "name": product.name,
        "slug": product.slug,
        "category": {
            "id": product.category_id,
            "name": product.category.name,
            "slug": product.category.slug,
        },
        "brand": {
            "id": product.brand_id,
            "name": product.brand.name,
            "slug": product.brand.slug,
        },
        "image_url": image_url(main_image.storage_key) if main_image else None,
        "min_price": format_money(min_price),
        "max_price": format_money(max_price),
        "promotional_min_price": format_money(promotional_min),
        "has_promotion": has_promotion,
        "total_stock": total_stock,
        "is_available": total_stock > 0 and len(active_variants) > 0,
        "variants_count": len(active_variants),
    }


class PublicProductsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        # EXISTS keeps one row per product without joining/deduplicating every
        # variant. All price/stock filters below must match the same variant.
        sellable = Variant.objects.filter(
            product_id=OuterRef("pk"),
            is_active=True,
            price__gte=0,
        )
        queryset = (
            Product.objects.visible()
            .select_related("category", "brand")
            .prefetch_related(
                "images",
                Prefetch(
                    "variants",
                    queryset=Variant.objects.filter(
                        is_active=True,
                        price__gte=0,
                    ).select_related("inventory_balance"),
                ),
            )
        )

        # Search parameter (name, description, category, brand)
        search = request.query_params.get("search", "").strip()[:180]
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(category__name__icontains=search)
                | Q(brand__name__icontains=search)
            )

        # Category filter (by slug or id)
        category_param = request.query_params.get("category", "").strip()
        if category_param:
            if category_param.isdigit():
                queryset = queryset.filter(category_id=int(category_param))
            else:
                queryset = queryset.filter(category__slug=category_param)

        # Brand filter (by slug or id)
        brand_param = request.query_params.get("brand", "").strip()
        if brand_param:
            if brand_param.isdigit():
                queryset = queryset.filter(brand_id=int(brand_param))
            else:
                queryset = queryset.filter(brand__slug=brand_param)

        # Price range filters
        min_price_param = request.query_params.get("min_price")
        if min_price_param is not None and min_price_param != "":
            try:
                min_val = Decimal(min_price_param)
                if min_val < 0:
                    raise serializers.ValidationError({"min_price": "Debe ser mayor o igual a 0."})
                sellable = sellable.filter(price__gte=min_val)
            except InvalidOperation as exc:
                raise serializers.ValidationError(
                    {"min_price": "Usa un valor numérico válido."}
                ) from exc

        max_price_param = request.query_params.get("max_price")
        if max_price_param is not None and max_price_param != "":
            try:
                max_val = Decimal(max_price_param)
                if max_val < 0:
                    raise serializers.ValidationError({"max_price": "Debe ser mayor o igual a 0."})
                sellable = sellable.filter(price__lte=max_val)
            except InvalidOperation as exc:
                raise serializers.ValidationError(
                    {"max_price": "Usa un valor numérico válido."}
                ) from exc

        # Availability filter (total_stock > 0)
        available_param = request.query_params.get("available")
        if available_param is not None and available_param != "":
            if available_param not in {"true", "false"}:
                raise serializers.ValidationError({"available": "Usa true o false."})
            if available_param == "true":
                sellable = sellable.filter(inventory_balance__available_quantity__gt=0)

        queryset = queryset.filter(Exists(sellable))

        # Ordering
        ordering = request.query_params.get("ordering", "-updated_at")
        if ordering == "name":
            queryset = queryset.order_by("name", "pk")
        elif ordering == "-name":
            queryset = queryset.order_by("-name", "-pk")
        elif ordering in {"price", "-price"}:
            # Order by the displayed starting price, ignoring hidden variants.
            prices = (
                Variant.objects.filter(
                    product_id=OuterRef("pk"),
                    is_active=True,
                    price__gte=0,
                )
                .order_by("price")
                .values("price")[:1]
            )
            queryset = queryset.alias(starting_price=Subquery(prices)).order_by(
                "starting_price" if ordering == "price" else "-starting_price",
                "pk",
            )
        else:
            queryset = queryset.order_by("-updated_at", "-id")

        paginator = CatalogPagination()
        page = paginator.paginate_queryset(queryset, request)

        # Collect variant IDs on the current page to resolve promotions efficiently in 1 query
        all_variant_ids = []
        for p in page:
            all_variant_ids.extend([v.pk for v in p.variants.all() if v.is_active])

        promo_offers = get_active_promotions_for_variants(all_variant_ids)

        data = [serialize_product_summary(p, promo_offers) for p in page]
        response = paginator.get_paginated_response(data)
        response["Cache-Control"] = "no-store"
        return response


class PublicProductDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        product = (
            Product.objects.visible()
            .filter(slug=slug)
            .select_related("category", "brand")
            .prefetch_related(
                "images",
                Prefetch(
                    "variants",
                    queryset=Variant.objects.filter(
                        is_active=True,
                        price__gte=0,
                    )
                    .select_related("inventory_balance")
                    .prefetch_related(
                        Prefetch(
                            "attribute_values",
                            queryset=VariantAttributeValue.objects.select_related("attribute"),
                        ),
                    ),
                ),
            )
            .first()
        )

        if product is None:
            raise NotFound("Producto no encontrado o no disponible.")

        active_variants = [v for v in product.variants.all() if v.is_active and v.price >= 0]
        variant_ids = [v.pk for v in active_variants]
        promo_offers = get_active_promotions_for_variants(variant_ids)

        serialized_variants = [
            serialize_variant(v, promo_offers.get(v.pk)) for v in active_variants
        ]

        images = [
            {
                "id": img.pk,
                "url": image_url(img.storage_key),
                "alt_text": img.alt_text,
                "sort_order": img.sort_order,
            }
            for img in product.images.all()
        ]

        total_stock = sum(v["stock"] for v in serialized_variants)

        data = {
            "id": product.pk,
            "name": product.name,
            "slug": product.slug,
            "description": product.description,
            "warranty": product.warranty,
            "category": {
                "id": product.category_id,
                "name": product.category.name,
                "slug": product.category.slug,
            },
            "brand": {
                "id": product.brand_id,
                "name": product.brand.name,
                "slug": product.brand.slug,
            },
            "images": images,
            "variants": serialized_variants,
            "total_stock": total_stock,
            "is_available": total_stock > 0 and len(active_variants) > 0,
        }

        response = Response(data)
        response["Cache-Control"] = "no-store"
        return response
