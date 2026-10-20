from django.urls import path

from .views import (
    AdminOrderDetailView,
    AdminOrderListView,
    AdminOrderTransitionView,
    AdminPaymentConfirmView,
    AdminPaymentListView,
    AdminPaymentRejectView,
    CartValidateView,
    CheckoutPreviewView,
    OrderCancelView,
    OrderDetailView,
    OrdersView,
    PaymentInstructionsView,
    PaymentReportView,
    PurchaseVariantsView,
)

urlpatterns = [
    path("purchase/variants/", PurchaseVariantsView.as_view()),
    path("checkout/validate/", CartValidateView.as_view()),
    path("checkout/preview/", CheckoutPreviewView.as_view()),
    path("orders/", OrdersView.as_view()),
    path("orders/<uuid:number>/", OrderDetailView.as_view()),
    path("orders/<uuid:number>/cancel/", OrderCancelView.as_view()),
    path("orders/<uuid:number>/payment-instructions/", PaymentInstructionsView.as_view()),
    path("orders/<uuid:number>/payment-report/", PaymentReportView.as_view()),
    path("admin/payments/", AdminPaymentListView.as_view()),
    path("admin/payments/<int:pk>/confirm/", AdminPaymentConfirmView.as_view()),
    path("admin/payments/<int:pk>/reject/", AdminPaymentRejectView.as_view()),
    path("admin/orders/", AdminOrderListView.as_view()),
    path("admin/orders/<uuid:number>/", AdminOrderDetailView.as_view()),
    path("admin/orders/<uuid:number>/transition/", AdminOrderTransitionView.as_view()),
]
