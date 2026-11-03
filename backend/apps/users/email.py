import json
from smtplib import SMTPException
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail import send_mail


class EmailDeliveryError(Exception):
    pass


def send_password_reset_email(recipient, reset_url):
    subject = "Restablece tu contraseña de TTI"
    text = (
        f"Abre este enlace para establecer una nueva contraseña: {reset_url}\n\n"
        "El enlace es temporal y solo puede utilizarse una vez."
    )
    return _send_transactional_email(recipient, subject, text)


def send_verification_email(recipient, verification_url):
    subject = "Confirma tu correo electrónico en TTI"
    text = (
        f"Hola, confirma tu cuenta abriendo este enlace: {verification_url}\n\n"
        "El enlace es temporal y solo puede utilizarse una vez."
    )
    return _send_transactional_email(recipient, subject, text)


def _send_transactional_email(recipient, subject, text):
    if not settings.BREVO_API_KEY:
        try:
            return send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [recipient])
        except (OSError, SMTPException) as exc:
            raise EmailDeliveryError from exc

    if not settings.BREVO_FROM_EMAIL:
        raise EmailDeliveryError("BREVO_FROM_EMAIL must be configured when Brevo is enabled")

    request = Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(
            {
                "sender": {
                    "name": settings.BREVO_FROM_NAME,
                    "email": settings.BREVO_FROM_EMAIL,
                },
                "to": [{"email": recipient}],
                "subject": subject,
                "textContent": text,
            }
        ).encode("utf-8"),
        headers={
            "api-key": settings.BREVO_API_KEY,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "CypherOz/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise EmailDeliveryError from exc
