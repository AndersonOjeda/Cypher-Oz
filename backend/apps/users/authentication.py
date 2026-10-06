from django.middleware.csrf import CsrfViewMiddleware
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import AuthSession


class CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


def enforce_csrf(request):
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    if check.process_view(request, None, (), {}):
        raise PermissionDenied("Solicitud no válida. Recarga la página e inténtalo de nuevo.")


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get("tti_access")
        if not raw_token:
            return None
        token = self.get_validated_token(raw_token)
        user = self.get_user(token)
        if not AuthSession.objects.filter(
            id=token.get("sid"),
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).exists():
            raise AuthenticationFailed("La sesión terminó. Inicia sesión de nuevo.")
        enforce_csrf(request)
        return user, token
