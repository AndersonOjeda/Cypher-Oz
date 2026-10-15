import json
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
    if not settings.RESEND_API_KEY:
        return send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [recipient])

    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps(
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [recipient],
                "subject": subject,
                "text": text,
            }
        ).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
            return json.loads(response.read())
    except (HTTPError, URLError, TimeoutError) as exc:
        raise EmailDeliveryError from exc
