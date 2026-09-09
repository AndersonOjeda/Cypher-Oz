from .development import *  # noqa: F403

DATABASES["default"]["NAME"] = "tti_e2e"  # noqa: F405
DATABASES["default"]["CONN_MAX_AGE"] = 0  # noqa: F405
FRONTEND_URL = "http://localhost:3001"
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
# The isolated browser suite deliberately exercises many logins from one IP.
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"auth": "1000/min"}}  # noqa: F405
