from django.db.models import Exists, OuterRef, Q
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.catalog.views import CatalogPagination
from apps.users.permissions import IsAdmin
from apps.users.views import private_response

from .models import ProductReview, ReviewReport
from .serializers import (
    ReviewCreateSerializer,
    ReviewModerateSerializer,
    ReviewReportCreateSerializer,
    ReviewUpdateSerializer,
    serialize_admin_report,
    serialize_admin_review,
    serialize_customer_review,
    serialize_public_review,
)
from .services import (
    create_verified_review,
    get_product_reviews_summary,
    moderate_review,
    report_review,
    update_own_review,
)

MODERATION_POLICY_NOTICE = (
    "Una valoración negativa (incluso de 1 estrella) no es motivo de retirada. "
    "Solo oculta reseñas que incumplan normas reales y registra siempre el motivo."
)


class ReviewPagination(CatalogPagination):
    page_size = 5
    page_size_query_param = "page_size"
    max_page_size = 20


class PublicProductReviewsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        product = Product.objects.visible().filter(slug=slug).first()
        if product is None:
            raise NotFound("Producto no encontrado o no disponible.")

        qs = (
            ProductReview.objects.filter(product=product, visibility="VISIBLE")
            .select_related("user", "order_item__order__payment")
            .order_by("-created_at", "-id")
        )
        pager = ReviewPagination()
        page = pager.paginate_queryset(qs, request)
        summary = get_product_reviews_summary(product.id)
        response = pager.get_paginated_response(
            [serialize_public_review(review) for review in page]
        )
        response.data["summary"] = summary
        response.data["moderation_policy"] = MODERATION_POLICY_NOTICE
        response["Cache-Control"] = "no-store"
        return response


class ReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = create_verified_review(request.user, serializer.validated_data)
        return private_response(serialize_customer_review(review), status=201)


class ReviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        serializer = ReviewUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = update_own_review(request.user, pk, serializer.validated_data)
        return private_response(serialize_customer_review(review), status=200)


class ReviewReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = ReviewReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = report_review(request.user, pk, serializer.validated_data["reason"])
        return private_response(
            {
                "id": report.id,
                "review_id": report.review_id,
                "status": report.status,
                "reason": report.reason,
                "created_at": report.created_at.isoformat(),
                "message": (
                    "Reporte registrado. La opinión permanece visible mientras "
                    "un administrador la revisa."
                ),
            },
            status=201,
        )


class AdminReviewListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        open_reports_subquery = ReviewReport.objects.filter(review_id=OuterRef("pk"), status="OPEN")
        qs = (
            ProductReview.objects.select_related("user", "product", "order_item__order__payment")
            .prefetch_related(
                "reports__reporter",
                "reports__resolved_by",
                "moderation_logs__actor",
            )
            .annotate(has_open=Exists(open_reports_subquery))
            .order_by("-created_at", "-id")
        )

        visibility = request.query_params.get("visibility", "").strip().upper()
        if visibility:
            if visibility not in {"VISIBLE", "HIDDEN"}:
                raise serializers.ValidationError({"visibility": "Usa VISIBLE o HIDDEN."})
            qs = qs.filter(visibility=visibility)

        has_open_param = request.query_params.get("has_open_reports", "").strip().lower()
        if has_open_param:
            if has_open_param not in {"true", "false"}:
                raise serializers.ValidationError({"has_open_reports": "Usa true o false."})
            qs = qs.filter(has_open=(has_open_param == "true"))

        rating_param = request.query_params.get("rating", "").strip()
        if rating_param:
            if not rating_param.isdigit() or int(rating_param) not in {1, 2, 3, 4, 5}:
                raise serializers.ValidationError(
                    {"rating": "Usa una calificación entera entre 1 y 5."}
                )
            qs = qs.filter(rating=int(rating_param))

        search = request.query_params.get("q", "").strip()[:180]
        if search:
            qs = qs.filter(
                Q(product__name__icontains=search)
                | Q(user__name__icontains=search)
                | Q(comment__icontains=search)
            )

        pager = CatalogPagination()
        page = pager.paginate_queryset(qs, request)
        response = pager.get_paginated_response([serialize_admin_review(review) for review in page])
        response.data["moderation_policy"] = MODERATION_POLICY_NOTICE
        response["Cache-Control"] = "no-store"
        return response


class AdminReviewModerateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        serializer = ReviewModerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = moderate_review(
            request.user,
            pk,
            serializer.validated_data["action"],
            serializer.validated_data["reason"],
        )
        return private_response(serialize_admin_review(review), status=200)


class AdminReviewReportListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = ReviewReport.objects.select_related(
            "review__product", "review__user", "reporter", "resolved_by"
        ).order_by("-created_at", "-id")

        status_param = request.query_params.get("status", "").strip().upper()
        if status_param:
            if status_param not in {
                "OPEN",
                "DISMISSED",
                "RESOLVED_HIDDEN",
                "RESOLVED_RESTORED",
            }:
                raise serializers.ValidationError({"status": "Estado inválido."})
            qs = qs.filter(status=status_param)

        pager = CatalogPagination()
        page = pager.paginate_queryset(qs, request)
        response = pager.get_paginated_response([serialize_admin_report(report) for report in page])
        response["Cache-Control"] = "no-store"
        return response
