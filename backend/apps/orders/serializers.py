from django.utils import timezone
from rest_framework import serializers

from .models import (
    Order,
    OrderDelivery,
    OrderItem,
    OrderStatusHistory,
    Payment,
    PaymentStatusHistory,
)


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise serializers.ValidationError({"non_field_errors": ["Hay campos no permitidos."]})
        return super().to_internal_value(data)


class IntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            self.fail("invalid")
        return super().to_internal_value(data)


class CartLineSerializer(StrictSerializer):
    variant_id = IntegerField(min_value=1)
    quantity = IntegerField(min_value=1, max_value=10000)


class CartValidationLineSerializer(CartLineSerializer):
    unit_price = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=0, required=False
    )


class CartValidationSerializer(StrictSerializer):
    items = CartValidationLineSerializer(many=True, max_length=100)

    def validate_items(self, value):
        if len({line["variant_id"] for line in value}) != len(value):
            raise serializers.ValidationError("No repitas una variante.")
        return value


class CheckoutSerializer(StrictSerializer):
    items = CartLineSerializer(many=True, allow_empty=False, max_length=100)
    delivery_mode = serializers.ChoiceField(choices=["PICKUP", "URBAN", "SPECIAL"])
    address_id = IntegerField(min_value=1, required=False, allow_null=True)

    def validate_items(self, value):
        if len({line["variant_id"] for line in value}) != len(value):
            raise serializers.ValidationError("No repitas una variante.")
        return sorted(value, key=lambda item: item["variant_id"])

    def validate(self, attrs):
        if attrs["delivery_mode"] != "PICKUP" and not attrs.get("address_id"):
            raise serializers.ValidationError({"address_id": "Selecciona una dirección."})
        if attrs["delivery_mode"] == "PICKUP":
            attrs["address_id"] = None
        return attrs


class CreateOrderSerializer(CheckoutSerializer):
    quote_token = serializers.CharField(max_length=16000)


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "variant_id",
            "product_name",
            "variant_name",
            "sku",
            "quantity",
            "unit_price",
            "discount",
            "total",
            "promotion",
        ]


class DeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderDelivery
        fields = ["mode", "address", "cost"]


class PaymentStatusHistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True)

    class Meta:
        model = PaymentStatusHistory
        fields = ["id", "status", "actor_email", "created_at"]


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = ["id", "status", "actor_email", "created_at"]


class PaymentSerializer(serializers.ModelSerializer):
    report_window_active = serializers.SerializerMethodField()
    history = PaymentStatusHistorySerializer(many=True, read_only=True)

    def get_report_window_active(self, obj):
        return obj.status == "PENDING" and timezone.now() < obj.report_deadline_at

    class Meta:
        model = Payment
        fields = [
            "id",
            "status",
            "reference",
            "reported_at",
            "report_deadline_at",
            "review_deadline_at",
            "report_window_active",
            "history",
        ]


class PaymentReportSerializer(StrictSerializer):
    reference = serializers.CharField(min_length=3, max_length=120)

    def validate_reference(self, value):
        if not any(char.isalnum() for char in value) or any(
            not char.isprintable() for char in value
        ):
            raise serializers.ValidationError("Escribe una referencia válida del pago.")
        return value


class PaymentRejectSerializer(StrictSerializer):
    reason = serializers.CharField(min_length=3, max_length=300)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    delivery = DeliverySerializer(read_only=True)
    payment = PaymentSerializer(read_only=True)
    history = OrderStatusHistorySerializer(many=True, read_only=True)
    currency = serializers.SerializerMethodField()

    def get_currency(self, obj):
        return "COP"

    class Meta:
        model = Order
        fields = [
            "number",
            "status",
            "subtotal",
            "discount",
            "shipping",
            "total",
            "currency",
            "created_at",
            "items",
            "delivery",
            "payment",
            "history",
        ]


class AdminPaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.UUIDField(source="order.number", read_only=True)
    customer_name = serializers.CharField(source="order.user.name", read_only=True)
    customer_email = serializers.CharField(source="order.user.email", read_only=True)
    order_total = serializers.DecimalField(
        source="order.total", max_digits=18, decimal_places=2, read_only=True
    )
    order_status = serializers.CharField(source="order.status", read_only=True)
    history = PaymentStatusHistorySerializer(many=True, read_only=True)
    report_window_active = serializers.SerializerMethodField()

    def get_report_window_active(self, obj):
        return obj.status == "PENDING" and timezone.now() < obj.report_deadline_at

    class Meta:
        model = Payment
        fields = [
            "id",
            "order_number",
            "customer_name",
            "customer_email",
            "order_total",
            "order_status",
            "status",
            "reference",
            "reported_at",
            "report_deadline_at",
            "review_deadline_at",
            "report_window_active",
            "history",
        ]


class AdminOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="user.name", read_only=True)
    customer_email = serializers.CharField(source="user.email", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    delivery = DeliverySerializer(read_only=True)
    payment = PaymentSerializer(read_only=True)
    history = OrderStatusHistorySerializer(many=True, read_only=True)
    currency = serializers.SerializerMethodField()

    def get_currency(self, obj):
        return "COP"

    class Meta:
        model = Order
        fields = [
            "number",
            "customer_name",
            "customer_email",
            "status",
            "subtotal",
            "discount",
            "shipping",
            "total",
            "currency",
            "created_at",
            "items",
            "delivery",
            "payment",
            "history",
        ]


class OrderTransitionSerializer(StrictSerializer):
    target_status = serializers.ChoiceField(choices=["PREPARING", "SHIPPED", "DELIVERED"])


class OrderCancelSerializer(StrictSerializer):
    reason = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default="Cancelación de pedido"
    )
