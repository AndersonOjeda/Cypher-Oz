"""Create sample stock only in the isolated classroom database, never replenish it."""

from django.conf import settings
from django.db import transaction

from apps.catalog.models import Brand, Category, Product, Variant
from apps.inventory.services import record_movement
from apps.users.models import User


@transaction.atomic
def seed():
    if settings.DATABASES["default"]["NAME"] != "tti_sprint1_demo":
        raise RuntimeError("Demo checkout seed requires tti_sprint1_demo.")
    admin = User.objects.get(email="admin@sprint1.example", role="ADMIN")
    category, _ = Category.objects.get_or_create(
        slug="demo-sprint1", defaults={"name": "Demostración Sprint 1"}
    )
    brand, _ = Brand.objects.get_or_create(
        slug="demo-sprint1", defaults={"name": "Demostración Sprint 1"}
    )
    product, _ = Product.objects.get_or_create(
        slug="teclado-demo-sprint1",
        defaults={
            "name": "Teclado de demostración",
            "description": "Producto didáctico local, no es una oferta comercial.",
            "category": category,
            "brand": brand,
            "is_active": True,
        },
    )
    variant, created = Variant.objects.get_or_create(
        sku="DEMO-CHECKOUT-01",
        defaults={
            "product": product,
            "name": "Demostración",
            "price": "40000.00",
            "is_active": True,
        },
    )
    if created:
        record_movement(
            variant_id=variant.pk,
            quantity=10,
            reason="Carga inicial didáctica Sprint 1",
            actor=admin,
            movement_type="ENTRY",
        )
