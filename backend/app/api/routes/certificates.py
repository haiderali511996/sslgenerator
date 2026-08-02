import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.certificate import Certificate
from app.models.domain import Domain
from app.models.payment import Payment
from app.models.user import User
from app.schemas.certificate import CertificateDownload, CertificateOut, CertificateRequest
from app.services.acme_client import AcmeIssuanceError, finalize_order, start_order

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

_OPENSSL_TIME_FORMAT = "%Y%m%d%H%M%SZ"


def _parse_openssl_time(value: str) -> datetime:
    return datetime.strptime(value, _OPENSSL_TIME_FORMAT)


def _get_owned_certificate(db: Session, certificate_id: uuid.UUID, user: User) -> Certificate:
    certificate = db.get(Certificate, certificate_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    domain = db.get(Domain, certificate.domain_id)
    if not domain or domain.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return certificate


@router.get("", response_model=list[CertificateOut])
def list_certificates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(Certificate)
        .join(Domain, Certificate.domain_id == Domain.id)
        .filter(Domain.owner_id == current_user.id)
        .order_by(Certificate.created_at.desc())
        .all()
    )


@router.post("", response_model=CertificateOut, status_code=201)
def request_certificate(payload: CertificateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Starts ACME issuance: creates the order and returns the HTTP file /
    DNS record the customer must publish on their own domain before calling
    the /finalize endpoint."""
    domain = db.get(Domain, payload.domain_id)
    if not domain or domain.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Domain not found")
    if not domain.is_verified:
        raise HTTPException(status_code=400, detail="Domain must be verified before requesting a certificate")
    if domain.verification_method not in ("http", "dns"):
        raise HTTPException(
            status_code=400,
            detail="Certificate issuance requires HTTP or DNS validation (email verification alone is not accepted by Let's Encrypt)",
        )

    payment: Payment | None = None
    if not current_user.is_unc_member:
        payment = (
            db.query(Payment)
            .filter(Payment.domain_id == domain.id, Payment.status == "confirmed", Payment.certificate_id.is_(None))
            .order_by(Payment.confirmed_at.desc())
            .first()
        )
        if not payment:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"This domain requires payment of {settings.unc_cert_price} UNC "
                    f"(or {settings.unc_min_balance_for_free}+ UNC in your linked wallet for free access). "
                    f"Pay via /api/payments/unc/submit, then retry."
                ),
            )

    certificate = Certificate(
        domain_id=domain.id,
        status="awaiting_challenge",
        validation_method=domain.verification_method,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    if payment:
        payment.certificate_id = certificate.id
        db.add(payment)
        db.commit()

    try:
        instructions = start_order(str(certificate.id), domain.name, domain.verification_method)
    except AcmeIssuanceError as exc:
        certificate.status = "failed"
        certificate.error_message = str(exc)
        db.add(certificate)
        db.commit()
        db.refresh(certificate)
        return certificate

    if instructions["type"] == "http":
        certificate.challenge_target = instructions["url_path"]
    else:
        certificate.challenge_target = instructions["record_name"]
    certificate.challenge_value = instructions.get("content") or instructions.get("record_value")

    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    return certificate


@router.post("/{certificate_id}/finalize", response_model=CertificateOut)
def finalize_certificate(certificate_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Call once the challenge file/DNS record is published on the customer's domain."""
    certificate = _get_owned_certificate(db, certificate_id, current_user)
    if certificate.status != "awaiting_challenge":
        raise HTTPException(status_code=400, detail=f"Certificate is not awaiting a challenge (status: {certificate.status})")

    try:
        result = finalize_order(str(certificate.id))
    except AcmeIssuanceError as exc:
        certificate.error_message = str(exc)
        db.add(certificate)
        db.commit()
        db.refresh(certificate)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    certificate.status = "issued"
    certificate.private_key_pem = result["private_key_pem"]
    certificate.certificate_pem = result["certificate_pem"]
    certificate.chain_pem = result["chain_pem"]
    certificate.not_before = _parse_openssl_time(result["not_before"])
    certificate.not_after = _parse_openssl_time(result["not_after"])
    certificate.issued_at = datetime.utcnow()
    certificate.error_message = None
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    return certificate


@router.get("/{certificate_id}/download", response_model=CertificateDownload)
def download_certificate(certificate_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    certificate = _get_owned_certificate(db, certificate_id, current_user)
    if certificate.status != "issued":
        raise HTTPException(status_code=400, detail="Certificate has not been issued yet")

    return CertificateDownload(
        certificate_pem=certificate.certificate_pem,
        chain_pem=certificate.chain_pem,
        private_key_pem=certificate.private_key_pem,
    )
