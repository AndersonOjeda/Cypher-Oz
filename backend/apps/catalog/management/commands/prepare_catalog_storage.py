from urllib.parse import urlparse

from botocore.exceptions import ClientError
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.catalog.storage import storage_client


class Command(BaseCommand):
    help = "Create a private bucket on a loopback S3 development server only."

    def handle(self, *args, **options):
        if urlparse(settings.CATALOG_S3_ENDPOINT).hostname not in {"localhost", "127.0.0.1"}:
            raise CommandError("Only a local development S3 endpoint is allowed.")
        client = storage_client()
        try:
            client.head_bucket(Bucket=settings.CATALOG_S3_BUCKET)
        except ClientError as exc:
            if str(exc.response["Error"]["Code"]) not in {"404", "NoSuchBucket"}:
                raise CommandError("Could not access the bucket.") from exc
            client.create_bucket(Bucket=settings.CATALOG_S3_BUCKET)
        self.stdout.write("Private local bucket ready.")
