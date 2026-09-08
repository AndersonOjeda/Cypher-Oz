import re

from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin
from apps.users.views import private_response

from .models import SettingChange, StoreSetting


class SettingsSerializer(serializers.Serializer):
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
