from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.response import Response

from apps.catalog.models import CatalogChange
from apps.catalog.views import CatalogPagination, Conflict, PrivateAdminMixin

from .models import Promotion
from .serializers import PromotionSerializer


class PromotionViewSet(PrivateAdminMixin, viewsets.ModelViewSet):
    serializer_class = PromotionSerializer
    pagination_class = CatalogPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        query = Promotion.objects.prefetch_related("prices__variant").all()
        state = self.request.query_params.get("state")
        now = timezone.now()
        if state == "current":
            query = query.filter(is_active=True, starts_at__lte=now, ends_at__gt=now)
        elif state == "scheduled":
            query = query.filter(is_active=True, starts_at__gt=now)
        elif state == "expired":
            query = query.filter(ends_at__lte=now)
        elif state not in {None, ""}:
            raise serializers.ValidationError({"state": "Usa current, scheduled o expired."})
        return query

    @staticmethod
    def record(request, instance, action):
        CatalogChange.objects.create(
            actor=request.user,
            entity="promotion",
            entity_id=instance.pk,
            action=action,
            changes={"name": instance.name},
        )

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                instance = serializer.save()
                self.record(self.request, instance, "create")
        except IntegrityError as exc:
            raise Conflict("La promoción no pudo guardarse por un conflicto de datos.") from exc

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                instance = Promotion.objects.select_for_update().get(pk=kwargs["pk"])
                serializer = self.get_serializer(instance, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                self.record(request, instance, "update")
                return Response(serializer.data)
        except Promotion.DoesNotExist:
            from rest_framework.exceptions import NotFound

            raise NotFound()
        except IntegrityError as exc:
            raise Conflict("La promoción no pudo guardarse por un conflicto de datos.") from exc

    def perform_destroy(self, instance):
        if instance.is_active:
            raise Conflict("Desactiva la promoción antes de eliminarla.")
        with transaction.atomic():
            instance = Promotion.objects.select_for_update().get(pk=instance.pk)
            self.record(self.request, instance, "delete")
            instance.delete()
