import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("app.email")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())


def send_email(to_email: str, subject: str, text: str, html: str | None = None) -> bool:
    """Sends one email over SMTP. Returns False (and logs) instead of raising, so a mail
    outage never breaks the request that triggered it.

    Blocking; call it with asyncio.to_thread from async code.
    """
    if not settings.smtp_host:
        logger.info("Email to %s (SMTP not configured, not sent)\nSubject: %s\n\n%s", to_email, subject, text)
        return False

    msg = EmailMessage()
    msg["From"] = settings.email_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        if settings.smtp_security == "ssl":
            server: smtplib.SMTP = smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, context=ssl.create_default_context(), timeout=15
            )
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        with server:
            if settings.smtp_security == "starttls":
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.send_message(msg)
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send email to %s", to_email)
        return False


def send_password_reset_email(to_email: str, raw_token: str) -> None:
    reset_link = f"{settings.frontend_base_url}/reset-password?token={raw_token}"
    logger.info("Password reset link for %s: %s", to_email, reset_link)
    send_email(
        to_email,
        "Reset your Institute password",
        f"Someone asked to reset the password for {to_email}.\n\n"
        f"Choose a new password here (the link expires in "
        f"{settings.password_reset_token_expire_minutes} minutes):\n{reset_link}\n\n"
        "If this wasn't you, ignore this email.",
    )
