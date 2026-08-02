import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_email(to_address: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to_address
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)


def send_domain_verification_email(to_address: str, domain_name: str, code: str) -> None:
    subject = f"Verify ownership of {domain_name} — UNC SSL"
    body = (
        f"You requested an SSL certificate for {domain_name} on UNC SSL Generator.\n\n"
        f"Your verification code is: {code}\n\n"
        f"Enter this code in the UNC SSL dashboard to confirm you control this domain.\n"
        f"If you did not request this, you can ignore this email."
    )
    send_email(to_address, subject, body)


def send_signup_verification_email(to_address: str, code: str) -> None:
    subject = "Verify your UNC SSL account"
    body = f"Your UNC SSL email verification code is: {code}"
    send_email(to_address, subject, body)
