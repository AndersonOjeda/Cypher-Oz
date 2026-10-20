"""Local performance environment, isolated from normal and E2E databases."""

from .base import *  # noqa: F403

DATABASES["default"]["NAME"] = "tti_loadtest"  # noqa: F405
if DATABASES["default"]["HOST"] not in {"localhost", "127.0.0.1"}:  # noqa: F405
    raise RuntimeError("Load tests only accept local PostgreSQL.")
DATABASES["default"]["CONN_MAX_AGE"] = 60  # noqa: F405
DATABASES["default"]["OPTIONS"] = {"connect_timeout": 5}  # noqa: F405
FRONTEND_URL = "http://localhost:3010"
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CSRF_COOKIE_SECURE = False
AUTH_COOKIE_SECURE = False

PERFORMANCE_LOG_ENABLED = True
MIDDLEWARE = ["apps.core.performance.RequestPerformanceMiddleware", *MIDDLEWARE]  # noqa: F405
LOAD_ARTIFACTS = BASE_DIR.parent / ".runtime" / "loadtest"  # noqa: F405
LOAD_ARTIFACTS.mkdir(parents=True, exist_ok=True)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"timestamp": {"format": "%(asctime)s %(levelname)s %(message)s"}},
    "handlers": {
        "performance": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOAD_ARTIFACTS / "requests.log"),
            "maxBytes": 10_000_000,
            "backupCount": 3,
            "encoding": "utf-8",
        },
        "server": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOAD_ARTIFACTS / "server.log"),
            "formatter": "timestamp",
            "maxBytes": 10_000_000,
            "backupCount": 3,
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "tti.performance": {"handlers": ["performance"], "level": "INFO", "propagate": False},
        "waitress": {"handlers": ["server"], "level": "WARNING", "propagate": False},
        "django.request": {"handlers": ["server"], "level": "WARNING", "propagate": False},
    },
}
