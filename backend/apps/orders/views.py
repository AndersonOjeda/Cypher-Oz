from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Variant
from apps.catalog.views import CatalogPagination
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance
from apps.promotions.services import get_active_promotions_for_variants
from apps.users.views import private_response

from .models import Order
from .serializers import (
    CartValidationSerializer,
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
        offers = get_active_promotions_for_variants([variant.pk for variant in variants])
        data = []
        for variant in variants:
            image = next(iter(variant.product.images.all()), None)
            data.append(
                {
                    "id": variant.pk,
                    "product_name": variant.product.name,
                    "name": variant.name,
                    "sku": variant.sku,
                    "price": format(
                        offers.get(variant.pk, {}).get("promotional_price", variant.price), ".2f"
                    ),
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


class CartValidateView(APIView):
    """CO-57 HU-09-T01: Authoritative cart revalidation against current DB state."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CartValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        ids = [item["variant_id"] for item in items]
        variants = {
            variant.pk: variant
            for variant in Variant.objects.available().filter(pk__in=ids).select_related("product")
        }
        balances = dict(
            InventoryBalance.objects.filter(variant_id__in=ids).values_list(
                "variant_id", "available_quantity"
            )
        )
        offers = get_active_promotions_for_variants(ids)
        results = []

        for item in items:
            variant_id = item.get("variant_id")
            requested_qty = item["quantity"]
            client_price = item.get("unit_price")

            variant = variants.get(variant_id)
            if variant is None:
                results.append(
                    {
                        "variant_id": variant_id,
                        "status": "inactive",
                        "message": "Este producto ya no está disponible.",
                        "current_price": None,
                        "available_qty": 0,
                    }
                )
                continue

            current_price = offers.get(variant_id, {}).get("promotional_price", variant.price)
            available_qty = balances.get(variant_id, 0)

            status = "ok"
            message = None

            if available_qty <= 0:
                status = "out_of_stock"
                message = "Sin stock disponible."
            elif available_qty < requested_qty:
                status = "insufficient_stock"
                message = f"Solo hay {available_qty} unidad(es) disponibles."
            elif client_price is not None:
                if client_price != current_price:
                    status = "price_changed"
                    message = "El precio ha cambiado."

            results.append(
                {
                    "variant_id": variant_id,
                    "product_name": variant.product.name,
                    "variant_name": variant.name,
                    "sku": variant.sku,
                    "status": status,
                    "message": message,
                    "current_price": format(current_price, ".2f"),
                    "available_qty": available_qty,
                }
            )

        has_changes = any(r["status"] != "ok" for r in results)
        return Response({"items": results, "has_changes": has_changes})
