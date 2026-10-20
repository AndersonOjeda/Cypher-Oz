import re

from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin
from apps.users.views import private_response

from .models import SettingChange, StoreSetting


class SettingsSerializer(serializers.Serializer):
    payment_instructions = serializers.CharField(allow_blank=True, max_length=2000, required=False)
    whatsapp_enabled = serializers.BooleanField()
    whatsapp_number = serializers.CharField(allow_blank=True, max_length=15)
    whatsapp_message = serializers.CharField(max_length=500)
    unpaid_order_timeout_hours = serializers.IntegerField(min_value=1)
    reported_payment_timeout_hours = serializers.IntegerField(min_value=1)
    urban_flat_shipping_rate = serializers.IntegerField(min_value=0)
    free_shipping_threshold = serializers.IntegerField(min_value=0)
    anonymous_cart_ttl_days = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        if attrs["whatsapp_enabled"] and not re.fullmatch(
            r"[1-9][0-9]{7,14}", attrs["whatsapp_number"]
        ):
            raise serializers.ValidationError(
                {"whatsapp_number": "Usa código de país y número, solo dígitos."}
            )
        return attrs


def all_settings():
    return dict(StoreSetting.objects.values_list("key", "value"))


class PublicSettingsView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        data = all_settings()
        return private_response(
            {
                key: data.get(key)
                for key in ["whatsapp_enabled", "whatsapp_number", "whatsapp_message"]
            }
        )


class AdminSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return private_response(all_settings())

    def patch(self, request):
        if not isinstance(request.data, dict) or set(request.data) - set(
            SettingsSerializer().fields
        ):
            raise serializers.ValidationError("Hay parámetros no permitidos.")
        with transaction.atomic():
            rows = list(StoreSetting.objects.select_for_update().order_by("key"))
            current = {row.key: row.value for row in rows}
            serializer = SettingsSerializer(data={**current, **request.data})
            serializer.is_valid(raise_exception=True)
            for key in request.data:
                SettingChange.objects.create(
                    actor=request.user,
                    key=key,
                    previous_value=current[key],
                    new_value=serializer.validated_data[key],
                )
                StoreSetting.objects.filter(key=key).update(value=serializer.validated_data[key])
        return private_response(serializer.data)


class DeliveryQuoteView(APIView):
    """CO-70 HU-28-T01: Compute authoritative delivery quote by mode and subtotal."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        from decimal import Decimal, InvalidOperation

        raw_mode = str(request.data.get("mode", "")).strip().upper()
        if raw_mode not in {"PICKUP", "URBAN", "SPECIAL"}:
            return private_response(
                {"detail": "Modalidad no válida. Use: PICKUP, URBAN o SPECIAL."}, status=400
            )

        raw_subtotal = request.data.get("subtotal", 0)
        try:
            subtotal = Decimal(str(raw_subtotal))
            if subtotal < 0:
                subtotal = Decimal("0")
        except (InvalidOperation, TypeError, ValueError):
            subtotal = Decimal("0")

        settings = all_settings()
        urban_rate = int(settings.get("urban_flat_shipping_rate", 5000))
        threshold = int(settings.get("free_shipping_threshold", 100000))

        if raw_mode == "PICKUP":
            return private_response({
                "mode": "PICKUP",
                "cost": "0.00",
                "can_confirm": true if hasattr(request, "_never") else True,
                "label": "Recogida en tienda (gratis)",
                "message": "",
                "free_shipping_threshold": str(threshold),
            })
        elif raw_mode == "SPECIAL":
            return private_response({
                "mode": "SPECIAL",
                "cost": None,
                "can_confirm": False,
                "label": "Zona especial — tarifa por confirmar",
                "message": "Tarifa especial por confirmar. No es posible crear el pedido todavía.",
                "free_shipping_threshold": str(threshold),
            })
        else:  # URBAN
            is_free = subtotal >= Decimal(str(threshold))
            cost = Decimal("0.00") if is_free else Decimal(str(urban_rate))
            label = (
                "Envío urbano en Pasto (Gratis por superar el umbral)"
                if is_free
                else f"Envío urbano en Pasto ($ {urban_rate:,} COP)"
            )
            return private_response({
                "mode": "URBAN",
                "cost": format(cost, ".2f"),
                "can_confirm": True,
                "is_free": is_free,
                "label": label,
                "message": "",
                "free_shipping_threshold": str(threshold),
                "urban_rate": str(urban_rate),
            })


class AdminDeliverySettingsView(APIView):
    """CO-70 HU-28-T01: Admin management of delivery rates and free shipping threshold."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        settings = all_settings()
        return private_response({
            "urban_flat_shipping_rate": settings.get("urban_flat_shipping_rate", 5000),
            "free_shipping_threshold": settings.get("free_shipping_threshold", 100000),
            "pickup_cost": 0,
        })

    def patch(self, request):
        allowed = {"urban_flat_shipping_rate", "free_shipping_threshold"}
        updates = {k: v for k, v in request.data.items() if k in allowed}
        if not updates:
            return private_response({"detail": "Ningún campo de entrega proporcionado."}, status=400)

        with transaction.atomic():
            rows = list(StoreSetting.objects.select_for_update().filter(key__in=updates.keys()))
            current = {r.key: r.value for r in rows}
            for key, val in updates.items():
                int_val = int(val)
                if int_val < 0:
                    raise serializers.ValidationError({key: "Debe ser mayor o igual a 0."})
                SettingChange.objects.create(
                    actor=request.user,
                    key=key,
                    previous_value=current.get(key, 0),
                    new_value=int_val,
                )
                StoreSetting.objects.update_or_create(key=key, defaults={"value": int_val})

        settings = all_settings()
        return private_response({
            "urban_flat_shipping_rate": settings.get("urban_flat_shipping_rate", 5000),
            "free_shipping_threshold": settings.get("free_shipping_threshold", 100000),
            "pickup_cost": 0,
        })
