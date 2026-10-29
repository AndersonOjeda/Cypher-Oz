import hashlib
import secrets
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.middleware.csrf import get_token, rotate_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import enforce_csrf
from .email import EmailDeliveryError, send_password_reset_email, send_verification_email
from .models import AuthSession, EmailVerificationToken, PasswordResetToken, User
from .serializers import (
    AddressSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class AuthThrottle(AnonRateThrottle):
    scope = "auth"


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"


class EmailServiceUnavailable(APIException):
    status_code = 503
    default_detail = "No pudimos enviar el correo. Inténtalo de nuevo en unos minutos."
    default_code = "email_service_unavailable"


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
        token = secrets.token_urlsafe(48)
        verification = EmailVerificationToken.objects.create(
            user=user,
            token_hash=reset_token_hash(token),
            expires_at=timezone.now() + timedelta(hours=24),
        )
        try:
            send_verification_email(
                user.email, f"{settings.FRONTEND_URL}/verificar-cuenta?token={token}"
            )
        except EmailDeliveryError:
            verification.delete()
            user.delete()
            raise EmailServiceUnavailable
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
        if not user.email_verified:
            raise AuthenticationFailed("Confirma tu correo antes de iniciar sesión.")
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


def reset_token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class VerifyEmailView(PublicAuthView):
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        token = str(request.data.get("token", ""))
        with transaction.atomic():
            verification = (
                EmailVerificationToken.objects.select_for_update()
                .select_related("user")
                .filter(token_hash=reset_token_hash(token), used_at__isnull=True)
                .first()
            )
            if not token or len(token) > 128 or verification is None or verification.expires_at <= timezone.now():
                return private_response({"code": "INVALID_VERIFICATION_TOKEN", "message": "El enlace no es válido o ya venció."}, status=400)
            verification.user.email_verified = True
            verification.user.save(update_fields=["email_verified"])
            verification.used_at = timezone.now()
            verification.save(update_fields=["used_at"])
        return private_response({"message": "Correo confirmado. Ya puedes iniciar sesión."})


class ResendVerificationView(PublicAuthView):
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True, email_verified=False).first()
        if user:
            token = secrets.token_urlsafe(48)
            EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
            EmailVerificationToken.objects.create(
                user=user,
                token_hash=reset_token_hash(token),
                expires_at=timezone.now() + timedelta(hours=24),
            )
            try:
                send_verification_email(user.email, f"{settings.FRONTEND_URL}/verificar-cuenta?token={token}")
            except EmailDeliveryError:
                raise EmailServiceUnavailable
        return private_response({"message": "Si la cuenta necesita verificación, enviaremos un nuevo enlace."})


class PasswordResetRequestView(PublicAuthView):
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], is_active=True
        ).first()
        if user:
            token = secrets.token_urlsafe(48)
            reset = PasswordResetToken.objects.create(
                user=user,
                token_hash=reset_token_hash(token),
                expires_at=timezone.now() + settings.PASSWORD_RESET_TOKEN_LIFETIME,
            )
            url = f"{settings.FRONTEND_URL}/restablecer-contrasena?token={token}"
            try:
                send_password_reset_email(user.email, url)
            except EmailDeliveryError:
                reset.delete()
                raise EmailServiceUnavailable
        return private_response(
            {"message": "Si el correo está registrado, recibirás instrucciones para continuar."}
        )


class PasswordResetConfirmView(PublicAuthView):
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_hash = reset_token_hash(serializer.validated_data["token"])
        with transaction.atomic():
            reset = (
                PasswordResetToken.objects.select_for_update()
                .select_related("user")
                .filter(token_hash=token_hash)
                .first()
            )
            if reset is None or reset.used_at is not None or reset.expires_at <= timezone.now():
                return private_response(
                    {
                        "code": "INVALID_RESET_TOKEN",
                        "message": "El enlace no es válido o ya venció.",
                    },
                    status=400,
                )
            try:
                validate_password(serializer.validated_data["password"], reset.user)
            except DjangoValidationError as exc:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"password": exc.messages}) from exc
            reset.user.set_password(serializer.validated_data["password"])
            reset.user.save(update_fields=["password"])
            now = timezone.now()
            reset.used_at = now
            reset.save(update_fields=["used_at"])
            AuthSession.objects.filter(user=reset.user, revoked_at__isnull=True).update(
                revoked_at=now
            )
            PasswordResetToken.objects.filter(user=reset.user, used_at__isnull=True).exclude(
                pk=reset.pk
            ).update(used_at=now)
        return private_response({"message": "Contraseña actualizada. Ya puedes iniciar sesión."})


class MeView(APIView):
    def get(self, request):
        return private_response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return private_response(UserSerializer(user).data)


class AddressListView(APIView):
    def get(self, request):
        return private_response(AddressSerializer(request.user.addresses.all(), many=True).data)

    def post(self, request):
        serializer = AddressSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        address = serializer.save()
        return private_response(AddressSerializer(address).data, status=201)


class AddressDetailView(APIView):
    def get_object(self, request, pk):
        return get_object_or_404(request.user.addresses, pk=pk)

    def get(self, request, pk):
        return private_response(AddressSerializer(self.get_object(request, pk)).data)

    def patch(self, request, pk):
        address = self.get_object(request, pk)
        serializer = AddressSerializer(address, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return private_response(AddressSerializer(serializer.save()).data)

    @transaction.atomic
    def delete(self, request, pk):
        User.objects.select_for_update().get(pk=request.user.pk)
        self.get_object(request, pk).delete()
        return private_response(status=204)


class AdminCustomerListView(APIView):
    """CO-62 HU-19-T01: Admin-only customer listing with order counts and search."""

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated

        from .permissions import IsAdmin

        return [IsAuthenticated(), IsAdmin()]

    def get(self, request):
        from django.db.models import Count, Q

        from apps.catalog.views import CatalogPagination

        search = request.query_params.get("q", "").strip()[:180]
        qs = (
            User.objects.filter(role=User.Role.CLIENT, is_active=True)
            .annotate(order_count=Count("order"))
            .order_by("-created_at", "-pk")
        )
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))
        pager = CatalogPagination()
        customers = pager.paginate_queryset(qs, request)
        data = [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "created_at": u.created_at.isoformat(),
                "order_count": u.order_count,
            }
            for u in customers
        ]
        response = pager.get_paginated_response(data)
        response["Cache-Control"] = "no-store"
        return response
