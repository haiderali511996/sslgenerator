import secrets
import string
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.domain import Domain
from app.models.verification import VerificationChallenge
from app.services import dns_checker, http_checker
from app.services.email_service import send_domain_verification_email

METHODS = {"http", "dns", "email"}


def _generate_token() -> str:
    return secrets.token_hex(16)


def _generate_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def start_verification(db: Session, domain: Domain, method: str, target_email: str | None = None) -> VerificationChallenge:
    if method not in METHODS:
        raise ValueError(f"Unsupported verification method: {method}")

    if method == "email":
        if not target_email or not target_email.lower().endswith(f"@{domain.name.lower()}"):
            raise ValueError("target_email must be an address on the domain being verified")
        expected_value = _generate_code()
        challenge = VerificationChallenge(
            domain_id=domain.id,
            method=method,
            token=expected_value,
            expected_value=expected_value,
            target_email=target_email,
            status="pending",
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        send_domain_verification_email(target_email, domain.name, expected_value)
        return challenge

    token = _generate_token()
    expected_value = secrets.token_hex(24) if method == "dns" else secrets.token_hex(24)

    challenge = VerificationChallenge(
        domain_id=domain.id,
        method=method,
        token=token,
        expected_value=expected_value,
        status="pending",
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


def check_verification(db: Session, challenge: VerificationChallenge, domain: Domain, submitted_code: str | None = None) -> bool:
    verified = False

    if challenge.method == "http":
        verified = http_checker.verify_http_challenge(domain.name, challenge.token, challenge.expected_value)
    elif challenge.method == "dns":
        verified = dns_checker.verify_txt_record(domain.name, challenge.expected_value)
    elif challenge.method == "email":
        verified = submitted_code is not None and secrets.compare_digest(submitted_code, challenge.expected_value)

    if verified:
        challenge.status = "verified"
        challenge.resolved_at = datetime.utcnow()
        domain.is_verified = True
        domain.verification_method = challenge.method
        domain.verified_at = datetime.utcnow()
        db.add_all([challenge, domain])
        db.commit()

    return verified
