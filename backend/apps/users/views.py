from datetime import datetime
from datetime import timezone as datetime_timezone

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.middleware.csrf import get_token, rotate_token
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import enforce_csrf
from .models import AuthSession
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class AuthThrottle(AnonRateThrottle):
    scope = "auth"


def private_response(data=None, status=200):
    response = Response(data, status=status)
    response["Cache-Control"] = "no-store"
    return response


def set_tokens(response, refresh):
    for name, token, lifetime in [
        ("tti_access", refresh.access_token, settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]),
        ("tti_refresh", refresh, settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]),
    ]:
        response.set_cookie(
            name,
            str(token),
            max_age=int(lifetime.total_seconds()),
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            path="/api/v1/",
        )
    return response


class PublicAuthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)


class CsrfView(PublicAuthView):
    throttle_classes = []

    def get(self, request):
        return private_response({"csrfToken": get_token(request)})


class RegisterView(PublicAuthView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return private_response(UserSerializer(user).data, status=201)


class LoginView(PublicAuthView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"].strip().lower(),
            password=serializer.validated_data["password"],
        )
        if user is None:
            raise AuthenticationFailed("Correo o contraseña incorrectos.")
        refresh = RefreshToken.for_user(user)
        session = AuthSession.objects.create(
            user=user,
            refresh_jti=refresh["jti"],
            expires_at=datetime.fromtimestamp(refresh["exp"], tz=datetime_timezone.utc),
        )
        refresh["sid"] = str(session.id)
        rotate_token(request)
        response = private_response(
            {"user": UserSerializer(user).data, "csrfToken": get_token(request)}
        )
        return set_tokens(response, refresh)

    def get_authenticate_header(self, request):
        return "Bearer"


def read_refresh(request):
    try:
        token = RefreshToken(request.COOKIES.get("tti_refresh", ""))
        if not token.get("sid"):
            raise TokenError()
        return token
    except TokenError as exc:
        raise AuthenticationFailed("La sesión terminó. Inicia sesión de nuevo.") from exc


class RefreshView(PublicAuthView):
    def get_authenticate_header(self, request):
        return "Bearer"

    def post(self, request):
        token = read_refresh(request)
        with transaction.atomic():
            session = (
                AuthSession.objects.select_for_update()
                .filter(
                    id=token["sid"],
                    user_id=token["user_id"],
                    revoked_at__isnull=True,
                    expires_at__gt=timezone.now(),
                    user__is_active=True,
                )
                .first()
            )
            if session is None or session.refresh_jti != token["jti"]:
                raise AuthenticationFailed("La sesión terminó. Inicia sesión de nuevo.")
            refresh = RefreshToken.for_user(session.user)
            refresh["sid"] = str(session.id)
            session.refresh_jti = refresh["jti"]
            session.expires_at = datetime.fromtimestamp(refresh["exp"], tz=datetime_timezone.utc)
            session.save(update_fields=["refresh_jti", "expires_at"])
        return set_tokens(private_response({"message": "Sesión renovada."}), refresh)


class LogoutView(PublicAuthView):
    throttle_classes = []

    def post(self, request):
        # Logout works with an expired access token and clears cookies even after expiry.
        try:
            token = read_refresh(request)
        except AuthenticationFailed:
            token = None
        if token is not None:
            AuthSession.objects.filter(
                id=token["sid"], user_id=token["user_id"], revoked_at__isnull=True
            ).update(revoked_at=timezone.now())
        response = private_response(status=204)
        for name in ["tti_access", "tti_refresh"]:
            response.delete_cookie(name, path="/api/v1/", samesite=settings.AUTH_COOKIE_SAMESITE)
        rotate_token(request)
        return response


class MeView(APIView):
    def get(self, request):
        return private_response(UserSerializer(request.user).data)
