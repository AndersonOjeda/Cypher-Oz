from django.db import migrations


def seed(apps, schema_editor):
    apps.get_model("configuration", "StoreSetting").objects.get_or_create(
        key="payment_instructions", defaults={"value": ""}
    )


class Migration(migrations.Migration):
    dependencies = [("configuration", "0003_settingchange")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
