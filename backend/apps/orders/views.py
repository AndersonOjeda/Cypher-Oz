from django.db.models import Q
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Variant
from apps.catalog.views import CatalogPagination
from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance
from apps.promotions.services import get_active_promotions_for_variants
from apps.users.permissions import IsAdmin
from apps.users.views import private_response

from .models import Order, Payment
from .serializers import (
    AdminOrderSerializer,
    AdminPaymentSerializer,
    CartValidationSerializer,
    CheckoutSerializer,
    CreateOrderSerializer,
    OrderCancelSerializer,
    OrderSerializer,
    OrderTransitionSerializer,
    PaymentRejectSerializer,
    PaymentReportSerializer,
    PaymentSerializer,
)
from .services import (
    cancel_order_by_user_or_admin,
    confirm_payment,
    create_order,
    preview,
    reject_payment,
    report_payment,
    transition_order,
)


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
        .prefetch_related("items", "history__actor", "payment__history__actor")
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


# ---------------------------------------------------------------------------
# SPRINT 6: HU-15, HU-17, HU-18 Admin and Cancellation Views
# ---------------------------------------------------------------------------


class AdminPaymentListView(APIView):
    """CO-44 HU-15-T02: Admin view of reported and all payments."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = (
            Payment.objects.select_related("order__user", "order")
            .prefetch_related("history__actor")
            .order_by("-reported_at", "-id")
        )
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        search = request.query_params.get("q", "").strip()
        if search:
            qs = qs.filter(
                Q(order__user__name__icontains=search)
                | Q(order__user__email__icontains=search)
                | Q(reference__icontains=search)
            )
        pager = CatalogPagination()
        page = pager.paginate_queryset(qs, request)
        response = pager.get_paginated_response(AdminPaymentSerializer(page, many=True).data)
        response["Cache-Control"] = "no-store"
        return response


class AdminPaymentConfirmView(APIView):
    """CO-44 HU-15-T02: Confirm payment after manual funds verification."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        payment = confirm_payment(request.user, pk)
        return private_response(AdminPaymentSerializer(payment).data)


class AdminPaymentRejectView(APIView):
    """CO-44 HU-15-T02: Reject payment with mandatory reason."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        serializer = PaymentRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = reject_payment(request.user, pk, serializer.validated_data["reason"])
        return private_response(AdminPaymentSerializer(payment).data)


class AdminOrderListView(APIView):
    """CO-43 HU-17-T01 / CO-71 HU-29-T01: Admin order list and logistics delivery filtering."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = (
            Order.objects.select_related("user", "delivery", "payment")
            .prefetch_related("items", "history__actor", "payment__history__actor")
            .order_by("-created_at", "-id")
        )
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        delivery_mode = request.query_params.get("delivery_mode")
        if delivery_mode:
            qs = qs.filter(delivery__mode=delivery_mode.upper())
        search = request.query_params.get("q", "").strip()
        if search:
            qs = qs.filter(
                Q(user__name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(number__icontains=search)
            )
        pager = CatalogPagination()
        page = pager.paginate_queryset(qs, request)
        response = pager.get_paginated_response(AdminOrderSerializer(page, many=True).data)
        response["Cache-Control"] = "no-store"
        return response


class AdminOrderDetailView(APIView):
    """CO-43 HU-17-T01: Admin detailed view of any order."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, number):
        order = get_object_or_404(
            Order.objects.select_related("user", "delivery", "payment").prefetch_related(
                "items", "history__actor", "payment__history__actor"
            ),
            number=number,
        )
        return private_response(AdminOrderSerializer(order).data)


class AdminOrderTransitionView(APIView):
    """CO-43 HU-17-T01: Advance order status with strict payment verification."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, number):
        serializer = OrderTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = transition_order(request.user, number, serializer.validated_data["target_status"])
        return private_response(AdminOrderSerializer(order).data)


class OrderCancelView(APIView):
    """CO-61 HU-18-T01: Atomic cancellation and inventory restoration for user or admin."""

    permission_classes = [IsAuthenticated]

    def post(self, request, number):
        serializer = OrderCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason") or "Cancelación de pedido"
        order = cancel_order_by_user_or_admin(request.user, number, reason)
        return private_response(OrderSerializer(order).data)
