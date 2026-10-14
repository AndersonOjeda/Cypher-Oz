from django.core.management.base import BaseCommand

from apps.catalog.storage import cleanup_images


class Command(BaseCommand):
    help = "Retry pending object-storage deletions (idempotent)."

    def handle(self, *args, **options):
        self.stdout.write(f"Removed {cleanup_images()} pending objects.")
