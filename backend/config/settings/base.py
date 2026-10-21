import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "corsheaders",
    "apps.core",
    "apps.users",
    "apps.configuration",
    "apps.catalog",
    "apps.inventory.apps.InventoryConfig",
    "apps.orders",
    "apps.promotions",
    "apps.assistant",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {"default": dj_database_url.parse(os.environ["DATABASE_URL"], conn_max_age=60)}
AUTH_USER_MODEL = "users.User"
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
        "OPTIONS": {"user_attributes": ["name", "email"]},
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
frontend_host = os.getenv("FRONTEND_HOST", "")
FRONTEND_URL = os.getenv("FRONTEND_URL") or (
    f"https://{frontend_host}" if frontend_host else "http://localhost:3000"
)
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = True
AUTH_COOKIE_SECURE = True
AUTH_COOKIE_SAMESITE = "Lax"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.users.authentication.CookieJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "apps.core.errors.exception_handler",
    "DEFAULT_THROTTLE_RATES": {"auth": "30/min", "password_reset": "5/hour", "assistant": "15/min"},
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}
PASSWORD_RESET_TOKEN_LIFETIME = timedelta(
    minutes=int(os.getenv("PASSWORD_RESET_TOKEN_MINUTES", "30"))
)
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@tti.local")
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "10"))
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "Cypher Oz <onboarding@resend.dev>")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CATALOG_S3_ENDPOINT = os.getenv("CATALOG_S3_ENDPOINT", "")
CATALOG_S3_REGION = os.getenv("CATALOG_S3_REGION", "us-east-1")
CATALOG_S3_BUCKET = os.getenv("CATALOG_S3_BUCKET", "")
CATALOG_S3_ACCESS_KEY = os.getenv("CATALOG_S3_ACCESS_KEY", "")
CATALOG_S3_SECRET_KEY = os.getenv("CATALOG_S3_SECRET_KEY", "")
CATALOG_IMAGE_MAX_BYTES = int(os.getenv("CATALOG_IMAGE_MAX_BYTES", "5242880"))
CATALOG_IMAGE_MAX_DIMENSION = int(os.getenv("CATALOG_IMAGE_MAX_DIMENSION", "4096"))
CATALOG_IMAGE_MAX_COUNT = int(os.getenv("CATALOG_IMAGE_MAX_COUNT", "8"))
DATA_UPLOAD_MAX_MEMORY_SIZE = CATALOG_IMAGE_MAX_BYTES + 65536
