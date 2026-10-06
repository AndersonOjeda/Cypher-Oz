from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.catalog.models import Variant
from apps.catalog.views import CatalogPagination
from apps.configuration.models import StoreSetting
from apps.users.views import private_response

from .models import Order
from .serializers import (
    CheckoutSerializer,
    CreateOrderSerializer,
    OrderSerializer,
    PaymentReportSerializer,
    PaymentSerializer,
)
from .services import create_order, preview, report_payment


class PurchaseVariantsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        query = (
            Variant.objects.available()
            .select_related("product", "inventory_balance")
            .prefetch_related("product__images")
            .order_by("product__name", "pk")
        )
        search = request.query_params.get("search", "").strip()[:180]
        if search:
            query = query.filter(product__name__icontains=search)
        pager = CatalogPagination()
        variants = pager.paginate_queryset(query, request)
        data = []
        for variant in variants:
            image = next(iter(variant.product.images.all()), None)
            data.append(
                {
                    "id": variant.pk,
                    "product_name": variant.product.name,
                    "name": variant.name,
                    "sku": variant.sku,
                    "price": format(variant.price, ".2f"),
                    "stock": getattr(
                        getattr(variant, "inventory_balance", None), "available_quantity", 0
                    ),
                    "image_url": image.storage_url if image else None,
                }
            )
        response = pager.get_paginated_response(data)
        response.data["cart_ttl_days"] = StoreSetting.objects.get(
            key="anonymous_cart_ttl_days"
        ).value
        response["Cache-Control"] = "no-store"
        return response


class CheckoutPreviewView(APIView):
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return private_response(preview(request.user, serializer.validated_data))


def orders_for(user):
    return (
        Order.objects.filter(user=user)
        .select_related("delivery", "payment")
        .prefetch_related("items")
    )


class OrdersView(APIView):
    def get(self, request):
        pager = CatalogPagination()
        page = pager.paginate_queryset(orders_for(request.user), request)
        response = pager.get_paginated_response(OrderSerializer(page, many=True).data)
        response["Cache-Control"] = "no-store"
        return response

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, created = create_order(
            request.user, serializer.validated_data, request.headers.get("Idempotency-Key")
        )
        return private_response(OrderSerializer(order).data, status=201 if created else 200)


class OrderDetailView(APIView):
    def get(self, request, number):
        order = get_object_or_404(orders_for(request.user), number=number)
        return private_response(OrderSerializer(order).data)


class PaymentInstructionsView(APIView):
    def get(self, request, number):
        order = get_object_or_404(orders_for(request.user), number=number)
        instructions = (
            StoreSetting.objects.filter(key="payment_instructions")
            .values_list("value", flat=True)
            .first()
            or ""
        )
        return private_response(
            {
                "number": str(order.number),
                "total": format(order.total, ".2f"),
                "currency": "COP",
                "payment_status": order.payment.status,
                "report_deadline_at": order.payment.report_deadline_at,
                "instructions": instructions,
                "configured": bool(instructions),
                "order_status": order.status,
                "payment": PaymentSerializer(order.payment).data,
            }
        )


class PaymentReportView(APIView):
    def post(self, request, number):
        serializer = PaymentReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = report_payment(request.user, number, serializer.validated_data["reference"])
        return private_response(PaymentSerializer(payment).data)
