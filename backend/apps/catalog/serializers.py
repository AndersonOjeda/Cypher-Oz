from rest_framework import serializers

from .models import Brand, Category, Product, ProductImage
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
    images = ImageSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    catalog_visible = serializers.BooleanField(read_only=True)
    catalog_available = serializers.BooleanField(read_only=True)

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
            "images",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def validate(self, attrs):
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
