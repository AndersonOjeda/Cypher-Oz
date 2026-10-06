from rest_framework import serializers

from apps.catalog.models import Variant
from apps.catalog.variant_serializers import TextField

from .models import MAX_QUANTITY, StockMovement


class StrictIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            self.fail("invalid")
        return super().to_internal_value(data)


class MovementInputSerializer(serializers.Serializer):
    variant = StrictIntegerField(min_value=1, max_value=9_223_372_036_854_775_807)
    quantity = StrictIntegerField(min_value=-MAX_QUANTITY, max_value=MAX_QUANTITY)
    reason = TextField(max_length=1000)

    def to_internal_value(self, data):
        if not hasattr(data, "keys") or set(data) - set(self.fields):
            raise serializers.ValidationError({"non_field_errors": "Hay campos no permitidos."})
        return super().to_internal_value(data)

    def validate_quantity(self, value):
        if value == 0:
            raise serializers.ValidationError("La cantidad debe ser distinta de cero.")
        return value


class BalanceSerializer(serializers.ModelSerializer):
    variant = serializers.IntegerField(source="pk")
    product_name = serializers.CharField(source="product.name")
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Variant
        fields = ["variant", "product_name", "name", "sku", "is_active", "available_quantity"]

    def get_available_quantity(self, variant):
        balance = getattr(variant, "inventory_balance", None)
        return balance.available_quantity if balance else 0


class MovementSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name")

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "variant",
            "sku",
            "type",
            "quantity",
            "previous_quantity",
            "resulting_quantity",
            "reason",
            "actor",
            "actor_name",
            "created_at",
        ]
        read_only_fields = fields
