from django.urls import include, path

from apps.catalog.public_views import (
    ProductCompareView,
    PublicProductDetailView,
    PublicProductsView,
)
from apps.catalog.views import PublicBrandsView, PublicCategoriesView
from apps.configuration.views import (
    AdminDeliverySettingsView,
    AdminSettingsView,
    DeliveryQuoteView,
    PublicSettingsView,
)
from apps.core.views import health
from apps.users.views import (
    AddressDetailView,
    AddressListView,
    AdminCustomerListView,
    CsrfView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
)

urlpatterns = [
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/delivery/quote/", DeliveryQuoteView.as_view()),
    path("api/v1/products/", PublicProductsView.as_view()),
    path("api/v1/products/compare/", ProductCompareView.as_view()),
    path("api/v1/products/<slug:slug>/", PublicProductDetailView.as_view()),
    path("api/v1/categories/", PublicCategoriesView.as_view()),
    path("api/v1/brands/", PublicBrandsView.as_view()),
    path("api/v1/admin/customers/", AdminCustomerListView.as_view()),
    path("api/v1/admin/delivery/settings/", AdminDeliverySettingsView.as_view()),
    path("api/v1/admin/inventory/", include("apps.inventory.urls")),
    path("api/v1/admin/promotions/", include("apps.promotions.urls")),
    path("api/v1/admin/", include("apps.catalog.urls")),
    path("health/", health),
    path("api/v1/auth/csrf/", CsrfView.as_view()),
    path("api/v1/auth/register/", RegisterView.as_view()),
    path("api/v1/auth/login/", LoginView.as_view()),
    path("api/v1/auth/refresh/", RefreshView.as_view()),
    path("api/v1/auth/logout/", LogoutView.as_view()),
    path("api/v1/auth/password-reset/request/", PasswordResetRequestView.as_view()),
    path("api/v1/auth/password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("api/v1/users/me/", MeView.as_view()),
    path("api/v1/users/me/addresses/", AddressListView.as_view()),
    path("api/v1/users/me/addresses/<int:pk>/", AddressDetailView.as_view()),
    path("api/v1/settings/public/", PublicSettingsView.as_view()),
    path("api/v1/admin/settings/", AdminSettingsView.as_view()),
]
