import re

from django.conf import settings
from django.core import mail
from django.http import Http404, JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def latest_verification_token(request):
    """Expose captured verification links only to the isolated E2E server."""
    if not getattr(settings, "E2E_TESTING", False):
        raise Http404

    email = request.GET.get("email", "").strip().lower()
    if not email:
        raise Http404

    for message in reversed(mail.outbox):
        if message.subject != "Confirma tu correo electrónico en TTI":
            continue
        if email not in {recipient.strip().lower() for recipient in message.to}:
            continue
        match = re.search(r"/verificar-cuenta\?token=([A-Za-z0-9_-]+)", message.body)
        if match:
            return JsonResponse({"token": match.group(1)})

    raise Http404
