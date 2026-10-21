from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from rest_framework import serializers

from apps.inventory.models import MAX_QUANTITY

from .models import CategoryAttribute, Variant, VariantAttributeValue
from .serializers import StrictModelSerializer


class TextField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class CodeField(serializers.SlugField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class BooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if not isinstance(data, bool):
            self.fail("invalid", input=data)
        return super().to_internal_value(data)


class PriceField(serializers.DecimalField):
    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, (str, int, float, Decimal)):
            self.fail("invalid")
        return super().to_internal_value(data)


class AttributeReferenceField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if not isinstance(data, int) or isinstance(data, bool):
            self.fail("incorrect_type", data_type=type(data).__name__)
        return super().to_internal_value(data)


class CategoryAttributeSerializer(StrictModelSerializer):
    code = CodeField(max_length=80)
    name = TextField(max_length=120)

    class Meta:
        model = CategoryAttribute
        fields = ["id", "category", "code", "name"]
        read_only_fields = ["id", "category"]
        validators = []


class VariantAttributeSerializer(StrictModelSerializer):
    attribute = AttributeReferenceField(queryset=CategoryAttribute.objects.all())
    code = serializers.CharField(source="attribute.code", read_only=True)
    name = serializers.CharField(source="attribute.name", read_only=True)
    value = TextField(max_length=500)

    class Meta:
        model = VariantAttributeValue
        fields = ["attribute", "code", "name", "value"]
        validators = []


class VariantSerializer(StrictModelSerializer):
    name = TextField(max_length=120, required=False)
    sku = TextField(max_length=80, required=False)
    initial_stock = serializers.IntegerField(
        min_value=0,
        max_value=MAX_QUANTITY,
        write_only=True,
        required=False,
    )
    stock = serializers.IntegerField(
        source="inventory_balance.available_quantity",
        read_only=True,
        default=0,
    )
    price = PriceField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    is_active = BooleanField(required=False)
    attributes = VariantAttributeSerializer(source="attribute_values", many=True, required=False)
    catalog_available = serializers.BooleanField(read_only=True)

    class Meta:
        model = Variant
        fields = [
            "id",
            "product",
            "name",
            "sku",
            "price",
            "is_active",
            "attributes",
            "catalog_available",
            "updated_at",
            "initial_stock",
            "stock",
        ]
        read_only_fields = ["id", "product", "updated_at"]
        validators = []

    def validate_sku(self, value):
        value = value.upper()
        if len(value) > 80:
            raise serializers.ValidationError("El SKU admite un máximo de 80 caracteres.")
        return value

    def validate(self, attrs):
        if self.instance and "initial_stock" in attrs:
            raise serializers.ValidationError(
                {"initial_stock": "Modifica las existencias desde Inventario."}
            )
        values = attrs.get("attribute_values", [])
        selected = set()
        product = self.context["product"]
        for entry in values:
            attribute = entry["attribute"]
            if attribute.category_id != product.category_id:
                raise serializers.ValidationError(
                    {"attributes": "Selecciona atributos de la categoría del producto."}
                )
            if attribute.pk in selected:
                raise serializers.ValidationError({"attributes": "No repitas un atributo."})
            selected.add(attribute.pk)
        return attrs

    @staticmethod
    def replace_attributes(instance, values):
        instance.attribute_values.all().delete()
        VariantAttributeValue.objects.bulk_create(
            [VariantAttributeValue(variant=instance, **entry) for entry in values]
        )

    @transaction.atomic
    def create(self, validated_data):
        values = validated_data.pop("attribute_values", [])
        stock = validated_data.pop("initial_stock", 0)
        validated_data.setdefault("sku", f"TTI-{uuid4().hex.upper()}")
        instance = Variant.objects.create(product=self.context["product"], **validated_data)
        self.replace_attributes(instance, values)
        if stock:
            from apps.inventory.models import StockMovement
            from apps.inventory.services import record_movement

            record_movement(
                variant_id=instance.pk,
                quantity=stock,
                reason="Existencias iniciales de la presentación",
                actor=self.context["request"].user,
                movement_type=StockMovement.Type.ENTRY,
            )
        return instance

    def update(self, instance, validated_data):
        values = validated_data.pop("attribute_values", None)
        instance = super().update(instance, validated_data)
        if values is not None:
            self.replace_attributes(instance, values)
        return instance
