import re

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.orders.serializers import StrictSerializer
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


class DeliveryQuoteSerializer(StrictSerializer):
    mode = serializers.ChoiceField(choices=["PICKUP", "URBAN", "SPECIAL"])
    subtotal = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, default=0)


class DeliverySettingsSerializer(StrictSerializer):
    urban_flat_shipping_rate = serializers.IntegerField(
        min_value=0, max_value=2147483647, required=False
    )
    free_shipping_threshold = serializers.IntegerField(
        min_value=0, max_value=2147483647, required=False
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Ningún campo de entrega proporcionado.")
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


class PublicCommercialInfoView(APIView):
    """CO-197 HU-36-T01: Consolidated public commercial information from live settings."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from decimal import Decimal

        data = all_settings()
        urban_rate = int(data.get("urban_flat_shipping_rate", 5000))
        threshold = int(data.get("free_shipping_threshold", 100000))
        unpaid_timeout = int(data.get("unpaid_order_timeout_hours", 24))
        reported_timeout = int(data.get("reported_payment_timeout_hours", 24))
        whatsapp_enabled = data.get("whatsapp_enabled") is True
        whatsapp_number = str(data.get("whatsapp_number", "") or "").strip()
        whatsapp_message = str(data.get("whatsapp_message", "") or "").strip()
        contact_configured = bool(
            whatsapp_enabled and re.fullmatch(r"[1-9][0-9]{7,14}", whatsapp_number)
        )
        payment_instructions_configured = bool(
            str(data.get("payment_instructions", "") or "").strip()
        )

        return private_response(
            {
                "payment": {
                    "mode": "EXTERNAL_MANUAL",
                    "payment_instructions_configured": payment_instructions_configured,
                    "unpaid_order_timeout_hours": unpaid_timeout,
                    "reported_payment_timeout_hours": reported_timeout,
                    "reported_meaning": (
                        "Pago reportado: el comprador registró la referencia de transferencia, "
                        "pero el pago aún no está confirmado."
                    ),
                    "confirmed_meaning": (
                        "Pago confirmado: un administrador verificó manualmente el ingreso real "
                        "de los fondos y autorizó el alistamiento del pedido."
                    ),
                    "manual_verification_notice": (
                        "El pago externo requiere verificación manual administrativa. Enviar la "
                        "referencia o escribir por WhatsApp no confirma el pago automáticamente."
                    ),
                },
                "delivery": {
                    "urban_flat_shipping_rate": format(Decimal(str(urban_rate)), ".2f"),
                    "free_shipping_threshold": format(Decimal(str(threshold)), ".2f"),
                    "pickup_cost": "0.00",
                    "modes": [
                        {
                            "mode": "PICKUP",
                            "label": "Recogida en tienda (Pasto)",
                            "cost": "0.00",
                            "can_confirm": True,
                            "summary": "Retiro presencial en tienda sin costo de envío.",
                        },
                        {
                            "mode": "URBAN",
                            "label": "Envío urbano en Pasto",
                            "cost": format(Decimal(str(urban_rate)), ".2f"),
                            "free_shipping_threshold": format(Decimal(str(threshold)), ".2f"),
                            "can_confirm": True,
                            "summary": (
                                f"Tarifa urbana de $ {urban_rate:,} COP; envío gratuito "
                                f"en compras desde $ {threshold:,} COP."
                            ),
                        },
                        {
                            "mode": "SPECIAL",
                            "label": "Envío a zona especial",
                            "cost": None,
                            "can_confirm": False,
                            "summary": (
                                "La cobertura y tarifa requieren cotización antes de confirmar."
                            ),
                        },
                    ],
                },
                "warranty": {
                    "source": "PRODUCT_APPROVED_FIELD",
                    "policy_summary": (
                        "La garantía aplicable corresponde exclusivamente a la informada y "
                        "aprobada en la ficha de cada producto."
                    ),
                    "missing_warranty_notice": (
                        "Condición comercial de garantía pendiente de definición en este producto. "
                        "Consulta por el canal de atención antes de confirmar tu compra."
                    ),
                },
                "contact": {
                    "configured": contact_configured,
                    "whatsapp_enabled": whatsapp_enabled,
                    "whatsapp_number": whatsapp_number if contact_configured else "",
                    "whatsapp_message": whatsapp_message,
                    "unavailable_notice": None
                    if contact_configured
                    else "Atención por WhatsApp no disponible temporalmente.",
                },
                "updated_at": timezone.now().isoformat(),
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
        from decimal import Decimal

        serializer = DeliveryQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_mode = serializer.validated_data["mode"]
        subtotal = serializer.validated_data["subtotal"]

        settings = all_settings()
        urban_rate = int(settings.get("urban_flat_shipping_rate", 5000))
        threshold = int(settings.get("free_shipping_threshold", 100000))

        if raw_mode == "PICKUP":
            return private_response(
                {
                    "mode": "PICKUP",
                    "cost": "0.00",
                    "can_confirm": True,
                    "label": "Recogida en tienda (gratis)",
                    "message": "",
                    "free_shipping_threshold": str(threshold),
                }
            )
        elif raw_mode == "SPECIAL":
            return private_response(
                {
                    "mode": "SPECIAL",
                    "cost": None,
                    "can_confirm": False,
                    "label": "Zona especial — tarifa por confirmar",
                    "message": (
                        "Tarifa especial por confirmar. No es posible crear el pedido todavía."
                    ),
                    "free_shipping_threshold": str(threshold),
                }
            )
        else:  # URBAN
            is_free = subtotal >= Decimal(str(threshold))
            cost = Decimal("0.00") if is_free else Decimal(str(urban_rate))
            label = (
                "Envío urbano en Pasto (Gratis por superar el umbral)"
                if is_free
                else f"Envío urbano en Pasto ($ {urban_rate:,} COP)"
            )
            return private_response(
                {
                    "mode": "URBAN",
                    "cost": format(cost, ".2f"),
                    "can_confirm": True,
                    "is_free": is_free,
                    "label": label,
                    "message": "",
                    "free_shipping_threshold": str(threshold),
                    "urban_rate": str(urban_rate),
                }
            )


class AdminDeliverySettingsView(APIView):
    """CO-70 HU-28-T01: Admin management of delivery rates and free shipping threshold."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        settings = all_settings()
        return private_response(
            {
                "urban_flat_shipping_rate": settings.get("urban_flat_shipping_rate", 5000),
                "free_shipping_threshold": settings.get("free_shipping_threshold", 100000),
                "pickup_cost": 0,
            }
        )

    def patch(self, request):
        serializer = DeliverySettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data

        with transaction.atomic():
            rows = list(StoreSetting.objects.select_for_update().filter(key__in=updates.keys()))
            current = {r.key: r.value for r in rows}
            for key, val in updates.items():
                int_val = val
                SettingChange.objects.create(
                    actor=request.user,
                    key=key,
                    previous_value=current.get(key, 0),
                    new_value=int_val,
                )
                StoreSetting.objects.update_or_create(key=key, defaults={"value": int_val})

        settings = all_settings()
        return private_response(
            {
                "urban_flat_shipping_rate": settings.get("urban_flat_shipping_rate", 5000),
                "free_shipping_threshold": settings.get("free_shipping_threshold", 100000),
                "pickup_cost": 0,
            }
        )
