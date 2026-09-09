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
