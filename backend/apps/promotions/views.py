from django.db import IntegrityError, transaction
from rest_framework import serializers, viewsets
from rest_framework.response import Response

from apps.catalog.models import CatalogChange
from apps.catalog.views import CatalogPagination, Conflict, PrivateAdminMixin

from .models import Promotion
from .serializers import PromotionSerializer


def audit_promotion(request, instance, action, changes=None):
    CatalogChange.objects.create(
        actor=request.user,
        entity="promotion",
        entity_id=instance.pk,
        action=action,
        changes=changes or {},
    )


class PromotionViewSet(PrivateAdminMixin, viewsets.ModelViewSet):
    queryset = Promotion.objects.prefetch_related("prices__variant__product").order_by("-id")
    serializer_class = PromotionSerializer
    pagination_class = CatalogPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        query = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()[:120]
        if search:
            query = query.filter(name__icontains=search)
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
                audit_promotion(self.request, instance, "create", {"name": instance.name})
        except IntegrityError as exc:
            raise Conflict("Error de integridad al guardar la promoción.") from exc

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                instance = self.get_object()
                serializer = self.get_serializer(instance, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                changes = {}
                for key in serializer.validated_data.keys():
                    changes[key] = {
                        "before": str(getattr(instance, key, None)),
                        "after": str(serializer.validated_data[key]),
                    }
                instance = serializer.save()
                audit_promotion(request, instance, "update", changes)
                return Response(serializer.data)
        except IntegrityError as exc:
            raise Conflict("Conflicto al actualizar la promoción.") from exc

    def perform_destroy(self, instance):
        with transaction.atomic():
            audit_promotion(self.request, instance, "delete", {"name": instance.name})
            instance.delete()
