from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.db.models import Sum
from django.utils.text import slugify
from rest_framework import serializers

from apps.inventory.models import MAX_QUANTITY

from .models import Brand, Category, Product, ProductImage, Variant
from .storage import image_url


class StrictModelSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        allowed = {key for key, field in self.fields.items() if not field.read_only}
        if not hasattr(data, "keys") or set(data.keys()) - allowed:
            raise serializers.ValidationError({"non_field_errors": ["Hay campos no permitidos."]})
        return super().to_internal_value(data)


class CategorySerializer(StrictModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "is_active", "updated_at"]
        read_only_fields = ["id", "updated_at"]

    def validate_name(self, value):
        query = self.Meta.model.objects.filter(name__iexact=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("Ya existe un registro con este nombre.")
        return value


class BrandSerializer(CategorySerializer):
    class Meta(CategorySerializer.Meta):
        model = Brand


class ImageSerializer(StrictModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "url", "alt_text", "sort_order", "width", "height", "byte_size"]
        read_only_fields = ["id", "url", "width", "height", "byte_size"]

    def get_url(self, obj):
        return image_url(obj.storage_key)


class ProductSerializer(StrictModelSerializer):
    initial_stock = serializers.IntegerField(
        min_value=0,
        max_value=MAX_QUANTITY,
        write_only=True,
        required=False,
    )
    initial_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        write_only=True,
        required=False,
    )
    images = ImageSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    catalog_visible = serializers.BooleanField(read_only=True)
    catalog_available = serializers.BooleanField(read_only=True)
    total_stock = serializers.SerializerMethodField()

    def get_total_stock(self, obj):
        return (
            obj.variants.filter(is_active=True, price__gte=0).aggregate(
                total=Sum("inventory_balance__available_quantity")
            )["total"]
            or 0
        )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "warranty",
            "category",
            "brand",
            "category_name",
            "brand_name",
            "is_active",
            "catalog_visible",
            "catalog_available",
            "total_stock",
            "images",
            "updated_at",
            "initial_price",
            "initial_stock",
        ]
        read_only_fields = ["id", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}

    @transaction.atomic
    def create(self, validated_data):
        price = validated_data.pop("initial_price", None)
        stock = validated_data.pop("initial_stock", 0)
        if "slug" not in validated_data:
            base = slugify(validated_data["name"])[:160] or "producto"
            validated_data["slug"] = f"{base}-{uuid4().hex}"
        product = super().create(validated_data)
        if price is not None:
            variant = Variant.objects.create(
                product=product,
                name="Estándar",
                price=price,
                sku=f"TTI-{uuid4().hex.upper()}",
                is_active=True,
            )
            if stock:
                from apps.inventory.models import StockMovement
                from apps.inventory.services import record_movement

                record_movement(
                    variant_id=variant.pk,
                    quantity=stock,
                    reason="Existencias iniciales al registrar el producto",
                    actor=self.context["request"].user,
                    movement_type=StockMovement.Type.ENTRY,
                )
        return product

    def validate(self, attrs):
        if "initial_stock" in attrs:
            if self.instance:
                raise serializers.ValidationError(
                    {"initial_stock": "Actualiza las existencias desde Inventario."}
                )
            if "initial_price" not in attrs:
                raise serializers.ValidationError(
                    {"initial_stock": "Indica también el precio inicial del producto."}
                )
        if self.instance and "initial_price" in attrs:
            raise serializers.ValidationError(
                {"initial_price": "Este precio solo se usa al registrar un producto."}
            )
        category = attrs.get("category")
        if (
            self.instance
            and category
            and category.pk != self.instance.category_id
            and self.instance.variants.filter(attribute_values__isnull=False)
            .exclude(attribute_values__attribute__category=category)
            .exists()
        ):
            raise serializers.ValidationError(
                {"category": "Las variantes tienen atributos de la categoría actual."}
            )
        for field in ["category", "brand"]:
            related = attrs.get(field, getattr(self.instance, field, None))
            # Existing inactive associations are kept for history, but cannot be newly selected.
            if (
                related
                and not related.is_active
                and (not self.instance or related.pk != getattr(self.instance, f"{field}_id"))
            ):
                raise serializers.ValidationError({field: "Selecciona un registro activo."})
        active = attrs.get("is_active", getattr(self.instance, "is_active", False))
        if active:
            for field in ["category", "brand"]:
                related = attrs.get(field, getattr(self.instance, field, None))
                if related and not related.is_active:
                    raise serializers.ValidationError(
                        {field: "Debe estar activo para activar el producto."}
                    )
        return attrs
