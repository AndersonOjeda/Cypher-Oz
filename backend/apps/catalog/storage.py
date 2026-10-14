import io
import logging
import warnings
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class StorageUnavailable(APIException):
    status_code = 503
    default_code = "storage_unavailable"
    default_detail = "No pudimos acceder a las imágenes. Inténtalo de nuevo más tarde."


def storage_client():
    if not settings.CATALOG_S3_BUCKET:
        raise StorageUnavailable()
    return boto3.client(
        "s3",
        endpoint_url=settings.CATALOG_S3_ENDPOINT or None,
        region_name=settings.CATALOG_S3_REGION,
        aws_access_key_id=settings.CATALOG_S3_ACCESS_KEY or None,
        aws_secret_access_key=settings.CATALOG_S3_SECRET_KEY or None,
        config=Config(
            signature_version="s3v4",
            connect_timeout=3,
            read_timeout=10,
            retries={"max_attempts": 1},
            s3={"addressing_style": "path"},
        ),
    )


def object_url(key):
    base = settings.CATALOG_S3_ENDPOINT or f"https://s3.{settings.CATALOG_S3_REGION}.amazonaws.com"
    return f"{base.rstrip('/')}/{settings.CATALOG_S3_BUCKET}/{quote(key)}"


def image_url(key):
    try:
        return storage_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.CATALOG_S3_BUCKET, "Key": key},
            ExpiresIn=900,
        )
    except (BotoCoreError, ClientError) as exc:
        raise StorageUnavailable() from exc


def upload_image(key, content):
    try:
        storage_client().put_object(
            Bucket=settings.CATALOG_S3_BUCKET,
            Key=key,
            Body=content,
            ContentType="image/webp",
            CacheControl="private, max-age=300",
        )
    except (BotoCoreError, ClientError) as exc:
        raise StorageUnavailable() from exc


def cleanup_images(limit=100):
    from .models import StorageDeletion

    completed = 0
    for pending in StorageDeletion.objects.filter(available_at__lte=timezone.now()).order_by("id")[
        :limit
    ]:
        try:
            storage_client().delete_object(
                Bucket=settings.CATALOG_S3_BUCKET, Key=pending.storage_key
            )
        except (BotoCoreError, ClientError, StorageUnavailable):
            logger.warning("Catalog storage cleanup deferred for record %s", pending.pk)
            continue
        pending.delete()
        completed += 1
    return completed


def validate_image(upload):
    extensions = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}
    mimes = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
    expected = extensions.get(Path(upload.name).suffix.lower())
    if not expected or upload.size > settings.CATALOG_IMAGE_MAX_BYTES:
        raise serializers.ValidationError(
            {"file": "Usa JPEG, PNG o WebP dentro del tamaño permitido."}
        )
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(upload, formats=["JPEG", "PNG", "WEBP"]) as original:
                if original.format != expected or upload.content_type != mimes[original.format]:
                    raise ValueError("File content does not match extension/MIME")
                if getattr(original, "n_frames", 1) != 1:
                    raise ValueError("Animated images are not supported")
                if max(original.size) > settings.CATALOG_IMAGE_MAX_DIMENSION:
                    raise ValueError("Image dimensions too large")
                original.verify()
            upload.seek(0)
            with Image.open(upload) as original:
                original.load()
                # Re-encode decoded pixels: no EXIF/GPS, appended payloads or original metadata.
                oriented = ImageOps.exif_transpose(original)
                clean = Image.new("RGBA", oriented.size)
                clean.paste(oriented.convert("RGBA"))
                clean.thumbnail((1920, 1920))
                output = io.BytesIO()
                clean.save(output, "WEBP", quality=85)
                content = output.getvalue()
                if len(content) > settings.CATALOG_IMAGE_MAX_BYTES:
                    raise ValueError("Encoded image too large")
                return content, clean.width, clean.height
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ) as exc:
        raise serializers.ValidationError(
            {"file": "La imagen no es válida o supera las dimensiones permitidas."}
        ) from exc
