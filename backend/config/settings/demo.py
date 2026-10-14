from .development import *  # noqa: F403

# A separate local database keeps classroom changes away from normal development data.
if DATABASES["default"]["HOST"] not in {"localhost", "127.0.0.1"}:  # noqa: F405
    raise RuntimeError("The classroom demo requires local PostgreSQL.")
DATABASES["default"]["NAME"] = "tti_sprint1_demo"  # noqa: F405
DATABASES["default"]["CONN_MAX_AGE"] = 0  # noqa: F405
FRONTEND_URL = "http://localhost:3002"
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
