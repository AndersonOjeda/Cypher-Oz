from .development import *  # noqa: F403

DATABASES["default"]["NAME"] = "tti_e2e"  # noqa: F405
DATABASES["default"]["CONN_MAX_AGE"] = 0  # noqa: F405
FRONTEND_URL = "http://localhost:3001"
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
CATALOG_S3_BUCKET = "tti-catalog-e2e"
# The isolated browser suite deliberately exercises many logins from one IP.
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].update(  # noqa: F405
    {"auth": "1000/min", "password_reset": "1000/hour"}
)
