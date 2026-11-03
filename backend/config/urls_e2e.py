from django.urls import path

from apps.users.e2e_views import latest_verification_token
from config.urls import urlpatterns as application_urlpatterns

urlpatterns = [
    *application_urlpatterns,
    path("__e2e__/verification-token/", latest_verification_token),
]
