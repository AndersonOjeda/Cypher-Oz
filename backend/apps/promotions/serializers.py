from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Variant
from apps.catalog.serializers import StrictModelSerializer

from .models import Promotion, PromotionVariant


class PromotionPriceSerializer(serializers.Serializer):
    variant = serializers.PrimaryKeyRelatedField(queryset=Variant.objects.all())
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"))


class PromotionSerializer(StrictModelSerializer):
    prices = PromotionPriceSerializer(many=True)

    class Meta:
        model = Promotion
        fields = ["id", "name", "starts_at", "ends_at", "is_active", "prices"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribe un nombre.")
        return value

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        active = attrs.get("is_active", getattr(self.instance, "is_active", False))
        prices = attrs.get("prices")
        if prices is None and self.instance:
            prices = list(self.instance.prices.select_related("variant"))
            variant_ids = [item.variant_id for item in prices]
        else:
            variant_ids = [item["variant"].pk for item in (prices or [])]
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "Debe ser posterior al inicio."})
        if len(variant_ids) != len(set(variant_ids)):
            raise serializers.ValidationError({"prices": "No repitas una variante."})
        if active and not variant_ids:
            raise serializers.ValidationError(
                {"prices": "Una promoción activa necesita al menos una variante."}
            )
        if active and starts_at and ends_at and variant_ids:
            overlapping = PromotionVariant.objects.filter(
                variant_id__in=variant_ids,
                promotion__is_active=True,
                promotion__starts_at__lt=ends_at,
                promotion__ends_at__gt=starts_at,
            )
            if self.instance:
                overlapping = overlapping.exclude(promotion=self.instance)
            if overlapping.exists():
                raise serializers.ValidationError(
                    {"prices": "Una variante ya tiene una promoción activa en ese periodo."}
                )
        return attrs

    @staticmethod
    def replace_prices(instance, prices):
        instance.prices.all().delete()
        PromotionVariant.objects.bulk_create(
            [PromotionVariant(promotion=instance, **item) for item in prices]
        )

    def create(self, validated_data):
        prices = validated_data.pop("prices")
        instance = Promotion.objects.create(**validated_data)
        self.replace_prices(instance, prices)
        return instance

    def update(self, instance, validated_data):
        prices = validated_data.pop("prices", None)
        instance = super().update(instance, validated_data)
        if prices is not None:
            self.replace_prices(instance, prices)
        return instance
