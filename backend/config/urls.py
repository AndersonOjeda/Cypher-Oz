from django.urls import include, path

from apps.configuration.views import AdminSettingsView, PublicSettingsView
from apps.core.views import health
from apps.users.views import CsrfView, LoginView, LogoutView, MeView, RefreshView, RegisterView

urlpatterns = [
    path("api/v1/admin/", include("apps.catalog.urls")),
    path("health/", health),
    path("api/v1/auth/csrf/", CsrfView.as_view()),
    path("api/v1/auth/register/", RegisterView.as_view()),
    path("api/v1/auth/login/", LoginView.as_view()),
    path("api/v1/auth/refresh/", RefreshView.as_view()),
    path("api/v1/auth/logout/", LogoutView.as_view()),
    path("api/v1/users/me/", MeView.as_view()),
    path("api/v1/settings/public/", PublicSettingsView.as_view()),
    path("api/v1/admin/settings/", AdminSettingsView.as_view()),
]
