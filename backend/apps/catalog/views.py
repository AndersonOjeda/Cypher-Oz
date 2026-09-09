from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin

from .models import Brand, CatalogChange, Category, Product, ProductImage, StorageDeletion
from .serializers import BrandSerializer, CategorySerializer, ImageSerializer, ProductSerializer
from .storage import cleanup_images, object_url, upload_image, validate_image


class Conflict(APIException):
    status_code = 409
    default_code = "catalog_conflict"
    default_detail = (
        "El registro está en uso o sus datos ya existen. Revisa el nombre y el identificador."
    )


def audit(request, instance, action, changes=None):
    CatalogChange.objects.create(
        actor=request.user,
        entity=instance._meta.model_name,
        entity_id=instance.pk,
        action=action,
        changes=changes or {},
    )


class PrivateAdminMixin:
    permission_classes = [IsAuthenticated, IsAdmin]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class CatalogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class CatalogViewSet(PrivateAdminMixin, viewsets.ModelViewSet):
    pagination_class = CatalogPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        query = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()[:180]
        if search:
            query = query.filter(Q(name__icontains=search) | Q(slug__icontains=search))
        active = self.request.query_params.get("active")
        if active is not None:
            if active not in {"true", "false"}:
                raise serializers.ValidationError({"active": "Usa true o false."})
            query = query.filter(is_active=active == "true")
        return query

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                instance = serializer.save()
                audit(self.request, instance, "create")
        except IntegrityError as exc:
            raise Conflict() from exc

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                instance = get_object_or_404(
                    self.get_queryset().select_for_update(of=("self",)), pk=kwargs["pk"]
                )
                serializer = self.get_serializer(instance, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                changes = {}
                for key, value in serializer.validated_data.items():
                    previous = getattr(instance, key)
                    changes[key] = {
                        "before": getattr(previous, "pk", previous),
                        "after": getattr(value, "pk", value),
                    }
                serializer.save()
                audit(request, instance, "update", changes)
                return Response(serializer.data)
        except self.queryset.model.DoesNotExist:
            from rest_framework.exceptions import NotFound

            raise NotFound()
        except IntegrityError as exc:
            raise Conflict() from exc

    def perform_destroy(self, instance):
        try:
            with transaction.atomic():
                instance = get_object_or_404(
                    self.queryset.model.objects.select_for_update(), pk=instance.pk
                )
                if isinstance(instance, Product) and instance.is_active:
                    raise Conflict("Desactiva el producto antes de eliminarlo.")
                audit(self.request, instance, "delete", {"name": instance.name})
                instance.delete()
        except (ProtectedError, IntegrityError) as exc:
            raise Conflict("El registro tiene relaciones. Desactívalo para conservarlas.") from exc


class CategoryViewSet(CatalogViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class BrandViewSet(CatalogViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer


class ProductViewSet(CatalogViewSet):
    queryset = Product.objects.select_related("category", "brand").prefetch_related("images")
    serializer_class = ProductSerializer


class UploadThrottle(UserRateThrottle):
    rate = "30/min"


class ProductImagesView(PrivateAdminMixin, APIView):
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [UploadThrottle]

    def get(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        return Response(ImageSerializer(product.images.all(), many=True).data)

    def post(self, request, product_id):
        get_object_or_404(Product, pk=product_id)
        if (
            set(request.data.keys()) - {"file", "alt_text"}
            or len(request.FILES.getlist("file")) != 1
        ):
            raise serializers.ValidationError({"file": "Selecciona una sola imagen."})
        metadata = ImageSerializer(data={"alt_text": request.data.get("alt_text", "")})
        metadata.is_valid(raise_exception=True)
        content, width, height = validate_image(request.FILES["file"])
        key = f"products/{product_id}/{uuid4().hex}.webp"
        # Persist compensation before the external write. Even a process crash leaves cleanup work.
        pending = StorageDeletion.objects.create(
            storage_key=key,
            available_at=timezone.now() + timedelta(hours=1),
        )
        try:
            with transaction.atomic():
                product = get_object_or_404(Product.objects.select_for_update(), pk=product_id)
                if product.images.count() >= settings.CATALOG_IMAGE_MAX_COUNT:
                    raise serializers.ValidationError(
                        {"file": "El producto alcanzó el máximo de imágenes."}
                    )
                upload_image(key, content)
                image = ProductImage.objects.create(
                    product=product,
                    storage_key=key,
                    storage_url=object_url(key),
                    width=width,
                    height=height,
                    byte_size=len(content),
                    sort_order=min(
                        (
                            product.images.order_by("-sort_order")
                            .values_list("sort_order", flat=True)
                            .first()
                            or 0
                        )
                        + 1,
                        32767,
                    ),
                    **metadata.validated_data,
                )
                audit(request, image, "upload", {"product": product_id})
                data = ImageSerializer(image).data
                pending.delete()
            return Response(data, status=status.HTTP_201_CREATED)
        except Exception:
            # Retry via cleanup_catalog_images if storage remains unavailable.
            raise


class ProductImageDetailView(PrivateAdminMixin, APIView):
    def patch(self, request, product_id, image_id):
        with transaction.atomic():
            get_object_or_404(Product.objects.select_for_update(), pk=product_id)
            image = get_object_or_404(ProductImage, pk=image_id, product_id=product_id)
            serializer = ImageSerializer(image, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            audit(request, image, "update", dict(serializer.validated_data))
            return Response(serializer.data)

    def delete(self, request, product_id, image_id):
        with transaction.atomic():
            get_object_or_404(Product.objects.select_for_update(), pk=product_id)
            image = get_object_or_404(ProductImage, pk=image_id, product_id=product_id)
            StorageDeletion.objects.get_or_create(storage_key=image.storage_key)
            audit(request, image, "delete", {"product": product_id})
            image.delete()
            transaction.on_commit(cleanup_images)
        return Response(status=204)


class CatalogLimitsView(PrivateAdminMixin, APIView):
    def get(self, request):
        return Response(
            {
                "max_image_bytes": settings.CATALOG_IMAGE_MAX_BYTES,
                "max_image_dimension": settings.CATALOG_IMAGE_MAX_DIMENSION,
                "max_images": settings.CATALOG_IMAGE_MAX_COUNT,
            }
        )
