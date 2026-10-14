from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.catalog.models import Variant
from apps.catalog.serializers import StrictModelSerializer
from apps.catalog.variant_serializers import PriceField, TextField

from .models import Promotion, PromotionVariant


class PromotionVariantSerializer(serializers.ModelSerializer):
    variant = serializers.PrimaryKeyRelatedField(queryset=Variant.objects.all())
    variant_sku = serializers.CharField(source="variant.sku", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True)
    product_name = serializers.CharField(source="variant.product.name", read_only=True)
    base_price = serializers.CharField(source="variant.price", read_only=True)
    price = PriceField(max_digits=12, decimal_places=2, min_value=Decimal("0"))

    class Meta:
        model = PromotionVariant
        fields = [
            "id",
            "variant",
            "variant_sku",
            "variant_name",
            "product_name",
            "base_price",
            "price",
        ]
        read_only_fields = ["id", "variant_sku", "variant_name", "product_name", "base_price"]

    def validate(self, attrs):
        variant = attrs.get("variant")
        price = attrs.get("price")
        if variant and price is not None:
            if price >= variant.price:
                raise serializers.ValidationError(
                    {"price": "El precio de promoción debe ser menor al precio base."}
                )
        return attrs


class PromotionSerializer(StrictModelSerializer):
    name = TextField(max_length=120)
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    is_active = serializers.BooleanField(default=False)
    prices = PromotionVariantSerializer(many=True, required=False)

    class Meta:
        model = Promotion
        fields = ["id", "name", "starts_at", "ends_at", "is_active", "prices"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", False))

        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError(
                {"ends_at": "La fecha de fin debe ser posterior a la fecha de inicio."}
            )

        prices_data = attrs.get("prices")
        variant_ids = set()

        if prices_data is not None:
            for item in prices_data:
                variant = item["variant"]
                price = item["price"]
                if variant.pk in variant_ids:
                    raise serializers.ValidationError(
                        {"prices": f"La variante {variant.sku} está duplicada en la promoción."}
                    )
                variant_ids.add(variant.pk)
                if price >= variant.price:
                    raise serializers.ValidationError(
                        {
                            "prices": (
                                f"El precio promocional para {variant.sku} "
                                "debe ser menor al precio base."
                            )
                        }
                    )
        elif self.instance:
            variant_ids = set(self.instance.prices.values_list("variant_id", flat=True))

        # Check overlapping active promotions for the same variants
        if is_active and starts_at and ends_at and variant_ids:
            overlapping = PromotionVariant.objects.filter(
                variant_id__in=variant_ids,
                promotion__is_active=True,
                promotion__starts_at__lt=ends_at,
                promotion__ends_at__gt=starts_at,
            )
            if self.instance:
                overlapping = overlapping.exclude(promotion_id=self.instance.pk)

            if overlapping.exists():
                conflict_variant = overlapping.select_related("variant", "promotion").first()
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            (
                                f"La variante {conflict_variant.variant.sku} tiene una "
                                f"promoción activa ('{conflict_variant.promotion.name}') "
                                "en ese período."
                            )
                        ]
                    }
                )

        return attrs

    def create(self, validated_data):
        prices_data = validated_data.pop("prices", [])
        with transaction.atomic():
            promotion = Promotion.objects.create(**validated_data)
            for item in prices_data:
                PromotionVariant.objects.create(promotion=promotion, **item)
            return promotion

    def update(self, instance, validated_data):
        prices_data = validated_data.pop("prices", None)
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if prices_data is not None:
                instance.prices.all().delete()
                for item in prices_data:
                    PromotionVariant.objects.create(promotion=instance, **item)
            return instance
