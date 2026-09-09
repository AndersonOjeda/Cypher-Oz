from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class NamedEntity(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True, max_length=3000)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(Lower("name"), name="%(class)s_name_ci_unique"),
            models.CheckConstraint(condition=~models.Q(name=""), name="%(class)s_name_not_empty"),
        ]


class Category(NamedEntity):
    class Meta(NamedEntity.Meta):
        db_table = "categories"


class Brand(NamedEntity):
    class Meta(NamedEntity.Meta):
        db_table = "brands"


class ProductQuerySet(models.QuerySet):
    def visible(self):
        # Reuse this policy when the public catalogue is implemented in Sprint 5.
        return self.filter(is_active=True, category__is_active=True, brand__is_active=True)

    def available(self):
        return self.visible().filter(variants__is_active=True, variants__price__gte=0).distinct()


class Product(models.Model):
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(max_length=10000)
    warranty = models.CharField(max_length=1000, blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products")
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = ProductQuerySet.as_manager()

    class Meta:
        db_table = "products"
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=~models.Q(name=""), name="product_name_not_empty"),
        ]

    @property
    def catalog_visible(self):
        return self.is_active and self.category.is_active and self.brand.is_active

    @property
    def catalog_available(self):
        return self.catalog_visible and self.variants.filter(is_active=True, price__gte=0).exists()


class CategoryAttribute(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="attributes")
    code = models.SlugField(max_length=80)
    name = models.CharField(max_length=120)

    class Meta:
        db_table = "category_attributes"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "code"], name="category_attribute_code_unique"
            ),
            models.CheckConstraint(condition=~models.Q(code=""), name="attribute_code_not_empty"),
            models.CheckConstraint(condition=~models.Q(name=""), name="attribute_name_not_empty"),
        ]


class VariantQuerySet(models.QuerySet):
    def available(self):
        return self.filter(
            is_active=True,
            price__gte=0,
            product__is_active=True,
            product__category__is_active=True,
            product__brand__is_active=True,
        )


class Variant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="variants")
    name = models.CharField(max_length=120, default="Estándar")
    sku = models.CharField(max_length=80, unique=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = VariantQuerySet.as_manager()

    class Meta:
        db_table = "variants"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(Lower("sku"), name="variant_sku_ci_unique"),
            models.CheckConstraint(condition=~models.Q(sku=""), name="variant_sku_not_empty"),
            models.CheckConstraint(condition=~models.Q(name=""), name="variant_name_not_empty"),
            models.CheckConstraint(
                condition=models.Q(price__gte=0, price__lte=Decimal("9999999999.99")),
                name="variant_price_valid_range",
            ),
        ]

    def save(self, *args, **kwargs):
        self.sku = self.sku.strip().upper()
        return super().save(*args, **kwargs)

    @property
    def catalog_available(self):
        return self.is_active and self.price >= 0 and self.product.catalog_visible


class VariantAttributeValue(models.Model):
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="attribute_values")
    attribute = models.ForeignKey(
        CategoryAttribute, on_delete=models.PROTECT, related_name="variant_values"
    )
    value = models.CharField(max_length=500)

    class Meta:
        db_table = "variant_attribute_values"
        ordering = ["attribute_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["variant", "attribute"], name="variant_attribute_unique"
            ),
            models.CheckConstraint(condition=~models.Q(value=""), name="variant_value_not_empty"),
        ]


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="images")
    storage_key = models.CharField(max_length=250, unique=True)
    storage_url = models.URLField(max_length=1000)
    alt_text = models.CharField(max_length=200)
    sort_order = models.PositiveSmallIntegerField(default=0)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    byte_size = models.PositiveIntegerField()
    content_type = models.CharField(max_length=40, default="image/webp")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "product_images"
        ordering = ["sort_order", "id"]


class StorageDeletion(models.Model):
    """Durable cleanup record: a storage outage must not resurrect a removed image."""

    storage_key = models.CharField(max_length=250, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    available_at = models.DateTimeField(default=timezone.now)


class CatalogChange(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    entity = models.CharField(max_length=30)
    entity_id = models.PositiveBigIntegerField()
    action = models.CharField(max_length=30)
    changes = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
