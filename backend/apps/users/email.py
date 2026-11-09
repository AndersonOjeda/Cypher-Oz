import json
from html import escape
from smtplib import SMTPException
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


class EmailDeliveryError(Exception):
    pass


def send_password_reset_email(recipient, reset_url):
    subject = "Restablece tu contraseña de TTI"
    title = "Restablece tu contraseña"
    intro = "Recibimos una solicitud para crear una nueva contraseña para tu cuenta."
    action = "Crear nueva contraseña"
    text = (
        f"{title}\n\n{intro}\n\n"
        f"Abre este enlace para continuar: {reset_url}\n\n"
        "Si no solicitaste este cambio, puedes ignorar este correo. "
        "Tu contraseña actual seguirá siendo la misma."
    )
    html = _build_action_email(
        preheader="Usa el enlace seguro para elegir una nueva contraseña.",
        title=title,
        intro=intro,
        action=action,
        action_url=reset_url,
        fallback_label="Si el botón no funciona, copia y pega este enlace en tu navegador:",
        footer="Si no solicitaste este cambio, ignora este mensaje. Tu contraseña no cambiará.",
    )
    return _send_transactional_email(recipient, subject, text, html)


def send_verification_email(recipient, verification_url):
    subject = "Confirma tu correo electrónico en TTI"
    title = "Confirma tu correo"
    intro = "¡Gracias por crear una cuenta! Confirma tu dirección para empezar a comprar."
    action = "Verificar mi correo"
    text = (
        f"{title}\n\n{intro}\n\n"
        f"Abre este enlace para confirmar tu cuenta: {verification_url}\n\n"
        "Si no creaste esta cuenta, puedes ignorar este correo."
    )
    html = _build_action_email(
        preheader="Confirma tu correo para activar tu cuenta de TTI.",
        title=title,
        intro=intro,
        action=action,
        action_url=verification_url,
        fallback_label="Si el botón no funciona, copia y pega este enlace en tu navegador:",
        footer="Si no creaste esta cuenta, puedes ignorar este mensaje.",
    )
    return _send_transactional_email(recipient, subject, text, html)


def _build_action_email(*, preheader, title, intro, action, action_url, fallback_label, footer):
    """Build a compact, accessible HTML email that works in common email clients."""
    safe_url = escape(action_url, quote=True)
    return f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>{escape(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;
            font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;
            color:transparent;">
      {escape(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="background-color:#f1f5f9;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="max-width:560px;background-color:#ffffff;
            border:1px solid #e2e8f0;border-radius:16px;">
          <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0;color:#2563eb;font-size:13px;font-weight:700;
            letter-spacing:2px;">TTI</p>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;">Tu tienda, a un clic</p>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:25px;line-height:1.3;color:#0f172a;">
              {escape(title)}
            </h1>
            <p style="margin:0 0 26px;font-size:16px;line-height:1.65;color:#334155;">
              {escape(intro)}
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"
              style="margin:0 0 24px;">
              <tr><td align="center" bgcolor="#2563eb" style="border-radius:8px;">
                <a href="{safe_url}"
                  style="display:inline-block;padding:14px 22px;border:1px solid #2563eb;
            border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;
            line-height:1.2;text-decoration:none;">{escape(action)}</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;">
              {escape(fallback_label)}
            </p>
            <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.6;">
              <a href="{safe_url}" style="color:#1d4ed8;">{escape(action_url)}</a></p>
          </td></tr>
          <tr><td style="padding:20px 32px;background-color:#f8fafc;
            border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">{escape(footer)}</p>
            <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">TTI · Cypher Oz</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def _send_transactional_email(recipient, subject, text, html):
    if not settings.BREVO_API_KEY:
        try:
            message = EmailMultiAlternatives(
                subject, text, settings.DEFAULT_FROM_EMAIL, [recipient]
            )
            message.attach_alternative(html, "text/html")
            return message.send()
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
                "htmlContent": html,
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
