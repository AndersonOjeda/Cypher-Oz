"""Narrow machine endpoint for an external deadline scheduler."""

import secrets

from django.conf import settings
from django.db import connection, transaction
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.expiration import process_payment_deadlines
from apps.users.models import User


class DeadlineJobView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        token = settings.OPS_SCHEDULER_TOKEN
        provided = request.headers.get("Authorization", "")
        if len(token) < 32 or not secrets.compare_digest(
            provided.encode("utf-8"), f"Bearer {token}".encode("utf-8")
        ):
            return self.reply({"code": "NOT_FOUND"}, 404)
        if (
            not isinstance(request.data, dict)
            or set(request.data) - {"dry_run"}
            or type(request.data.get("dry_run", False)) is not bool
        ):
            return self.reply({"code": "INVALID_JOB_INPUT"}, 400)
        actor = User.objects.filter(
            email__iexact=settings.OPS_SCHEDULER_ACTOR_EMAIL,
            role=User.Role.ADMIN,
            is_active=True,
        ).first()
        if actor is None:
            return self.reply({"code": "JOB_ACTOR_UNAVAILABLE"}, 503)
        # Protect against overlapping external triggers across all Gunicorn processes.
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [91846001])
                if not cursor.fetchone()[0]:
                    return self.reply({"code": "JOB_ALREADY_RUNNING"}, 409)
            result = process_payment_deadlines(
                actor, limit=100, dry_run=request.data.get("dry_run", False)
            )
        # Never expose order numbers or per-order exceptions through the machine API.
        summary = {name: result[name] for name in ("candidates", "cancelled", "alerted", "skipped")}
        summary["failed_count"] = len(result["failed"])
        summary["dry_run"] = request.data.get("dry_run", False)
        return self.reply(summary, 503 if result["failed"] else 200)

    @staticmethod
    def reply(data, status=200):
        response = Response(data, status=status)
        response["Cache-Control"] = "no-store"
        return response
