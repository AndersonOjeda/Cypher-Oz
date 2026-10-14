import os

from django.db import migrations


def promote_configured_staging_admin(apps, schema_editor):
    email = os.getenv("STAGING_ADMIN_EMAIL", "").strip().lower()
    if not email:
        return
    User = apps.get_model("users", "User")
    User.objects.filter(email__iexact=email).update(role="ADMIN")


class Migration(migrations.Migration):
    dependencies = [("users", "0004_bootstrap_staging_admin")]
    operations = [
        migrations.RunPython(
            promote_configured_staging_admin,
            migrations.RunPython.noop,
        )
    ]
