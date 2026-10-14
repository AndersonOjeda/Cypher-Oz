import os

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import User


class Command(BaseCommand):
    help = "Create or promote the staging administrator configured by environment variable."

    @transaction.atomic
    def handle(self, *args, **options):
        email = os.getenv("STAGING_ADMIN_EMAIL", "").strip().lower()
        if not email:
            self.stdout.write("STAGING_ADMIN_EMAIL is not configured; skipping admin bootstrap.")
            return

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User(email=email, name=os.getenv("STAGING_ADMIN_NAME", "Administrador Staging"))
            user.set_unusable_password()
            user.role = User.Role.ADMIN
            user.full_clean()
            user.save()
            self.stdout.write(self.style.SUCCESS("Staging administrator created."))
            return

        if user.role != User.Role.ADMIN:
            user.role = User.Role.ADMIN
            user.save(update_fields=["role"])
        self.stdout.write(self.style.SUCCESS("Staging administrator is ready."))
