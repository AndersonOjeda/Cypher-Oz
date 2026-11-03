from django.urls import path

from .views import (
    AdminReviewListView,
    AdminReviewModerateView,
    AdminReviewReportListView,
    PublicProductReviewsView,
    ReviewCreateView,
    ReviewDetailView,
    ReviewReportCreateView,
)

urlpatterns = [
    path("products/<slug:slug>/reviews/", PublicProductReviewsView.as_view()),
    path("reviews/", ReviewCreateView.as_view()),
    path("reviews/<int:pk>/", ReviewDetailView.as_view()),
    path("reviews/<int:pk>/report/", ReviewReportCreateView.as_view()),
    path("admin/reviews/", AdminReviewListView.as_view()),
    path("admin/reviews/<int:pk>/moderate/", AdminReviewModerateView.as_view()),
    path("admin/review-reports/", AdminReviewReportListView.as_view()),
]
