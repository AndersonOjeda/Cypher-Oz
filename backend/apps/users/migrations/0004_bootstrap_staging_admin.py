import os

from django.contrib.auth.hashers import make_password
from django.db import migrations


def bootstrap_staging_admin(apps, schema_editor):
    email = os.getenv("STAGING_ADMIN_EMAIL", "").strip().lower()
    if not email:
        return

    User = apps.get_model("users", "User")
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        User.objects.create(
            email=email,
            name=os.getenv("STAGING_ADMIN_NAME", "Administrador Staging"),
            password=make_password(None),
            role="ADMIN",
            is_active=True,
        )
        return

    if user.role != "ADMIN":
        user.role = "ADMIN"
        user.save(update_fields=["role"])


class Migration(migrations.Migration):
    dependencies = [("users", "0003_passwordresettoken")]
    operations = [migrations.RunPython(bootstrap_staging_admin, migrations.RunPython.noop)]
