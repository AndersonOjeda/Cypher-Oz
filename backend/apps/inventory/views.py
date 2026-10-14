from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Variant
from apps.catalog.views import CatalogPagination, PrivateAdminMixin

from .models import StockMovement
from .serializers import BalanceSerializer, MovementInputSerializer, MovementSerializer
from .services import record_movement


def variant_filter(request):
    value = request.query_params.get("variant")
    if value is None:
        return None
    if (
        not value.isascii()
        or not value.isdecimal()
        or not 0 < int(value) <= 9_223_372_036_854_775_807
    ):
        raise serializers.ValidationError({"variant": "Usa un identificador entero positivo."})
    return int(value)


class InventoryView(PrivateAdminMixin, APIView):
    def get(self, request):
        query = Variant.objects.select_related("product", "inventory_balance").order_by("sku", "id")
        search = request.query_params.get("search", "").strip()[:180]
        if search:
            query = query.filter(Q(sku__icontains=search) | Q(product__name__icontains=search))
        variant_id = variant_filter(request)
        if variant_id is not None:
            query = query.filter(pk=variant_id)
        pagination = CatalogPagination()
        page = pagination.paginate_queryset(query, request)
        return pagination.get_paginated_response(BalanceSerializer(page, many=True).data)


class EntryView(PrivateAdminMixin, APIView):
    movement_type = StockMovement.Type.ENTRY

    def post(self, request):
        serializer = MovementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        movement = record_movement(
            variant_id=data["variant"],
            quantity=data["quantity"],
            reason=data["reason"],
            actor=request.user,
            movement_type=self.movement_type,
        )
        return Response(MovementSerializer(movement).data, status=201)


class AdjustmentView(EntryView):
    movement_type = StockMovement.Type.ADJUSTMENT


class MovementsView(PrivateAdminMixin, APIView):
    def get(self, request):
        query = StockMovement.objects.select_related("actor")
        variant_id = variant_filter(request)
        if variant_id is not None:
            query = query.filter(variant_id=variant_id)
        movement_type = request.query_params.get("type")
        if movement_type is not None:
            if movement_type not in StockMovement.Type.values:
                raise serializers.ValidationError(
                    {"type": "Selecciona un tipo de movimiento válido."}
                )
            query = query.filter(type=movement_type)
        pagination = CatalogPagination()
        page = pagination.paginate_queryset(query, request)
        return pagination.get_paginated_response(MovementSerializer(page, many=True).data)
