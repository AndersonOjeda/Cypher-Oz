from django.db import migrations


def seed(apps, schema_editor):
    setting = apps.get_model("configuration", "StoreSetting")
    for key, value in {
        "whatsapp_enabled": False,
        "whatsapp_number": "",
        "whatsapp_message": "Hola, quiero recibir asesoría sobre TTI.",
        "unpaid_order_timeout_hours": 12,
        "reported_payment_timeout_hours": 24,
        "urban_flat_shipping_rate": 5000,
        "free_shipping_threshold": 100000,
        "anonymous_cart_ttl_days": 14,
    }.items():
        setting.objects.get_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [("configuration", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
