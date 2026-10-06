from django.apps import AppConfig
from django.db.models.signals import post_save


def initialize_balance(sender, instance, created, raw, using, **kwargs):
    if created and not raw:
        from .models import InventoryBalance

        InventoryBalance.objects.using(using).get_or_create(variant_id=instance.pk)


class InventoryConfig(AppConfig):
    name = "apps.inventory"

    def ready(self):
        post_save.connect(
            initialize_balance, sender="catalog.Variant", dispatch_uid="inventory.initial_balance"
        )
