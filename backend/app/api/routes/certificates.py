import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.certificate import Certificate
from app.models.domain import Domain
from app.models.payment import Payment
from app.models.user import User
from app.schemas.certificate import CertificateDownload, CertificateOut, CertificateRequest
from app.services.acme_client import ALLOWED_KEY_SIZES, AcmeIssuanceError, finalize_order, start_order

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

_OPENSSL_TIME_FORMAT = "%Y%m%d%H%M%SZ"
CANCELLABLE_STATUSES = ("pending", "awaiting_challenge", "failed")


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


def _get_owned_verified_domain(db: Session, domain_id: uuid.UUID, user: User) -> Domain:
    domain = db.get(Domain, domain_id)
    if not domain or domain.owner_id != user.id:
        raise HTTPException(status_code=404, detail=f"Domain {domain_id} not found")
    return domain


@router.get("", response_model=list[CertificateOut])
def list_certificates(
    q: str | None = Query(default=None, description="Filter by domain name substring"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificates = (
        db.query(Certificate)
        .join(Domain, Certificate.domain_id == Domain.id)
        .filter(Domain.owner_id == current_user.id)
        .order_by(Certificate.created_at.desc())
        .all()
    )
    if not q:
        return certificates

    needle = q.strip().lower()
    domain_names = {d.id: d.name for d in db.query(Domain).filter(Domain.owner_id == current_user.id)}
    return [
        c
        for c in certificates
        if needle in domain_names.get(c.domain_id, "").lower() or any(needle in name.lower() for name in c.additional_domains)
    ]


@router.post("", response_model=CertificateOut, status_code=201)
def request_certificate(payload: CertificateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Starts ACME issuance: creates the order and returns the HTTP file(s) /
    DNS record(s) the customer must publish on each domain before calling
    the /finalize endpoint."""
    if payload.key_size not in ALLOWED_KEY_SIZES:
        raise HTTPException(status_code=400, detail=f"key_size must be one of {ALLOWED_KEY_SIZES}")

    domain = _get_owned_verified_domain(db, payload.domain_id, current_user)
    if not domain.is_verified:
        raise HTTPException(status_code=400, detail="Domain must be verified before requesting a certificate")
    if domain.verification_method not in ("http", "dns"):
        raise HTTPException(
            status_code=400,
            detail="Certificate issuance requires HTTP or DNS validation (email verification alone is not accepted by Let's Encrypt)",
        )
    if payload.wildcard and domain.verification_method != "dns":
        raise HTTPException(
            status_code=400,
            detail="Wildcard certificates can only be validated via DNS-01 — re-verify this domain using the DNS TXT method.",
        )

    additional_domains: list[Domain] = []
    for extra_id in payload.additional_domain_ids:
        extra_domain = _get_owned_verified_domain(db, extra_id, current_user)
        if not extra_domain.is_verified:
            raise HTTPException(status_code=400, detail=f"Domain {extra_domain.name} must be verified first")
        if extra_domain.verification_method != domain.verification_method:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"All domains on one certificate must use the same validation method. "
                    f"{domain.name} is verified via {domain.verification_method}, "
                    f"but {extra_domain.name} is verified via {extra_domain.verification_method}."
                ),
            )
        additional_domains.append(extra_domain)

    domain_names = [domain.name]
    if payload.wildcard:
        domain_names.append(f"*.{domain.name}")
    domain_names.extend(d.name for d in additional_domains)

    payment: Payment | None = None
    if settings.unc_payments_enabled and not current_user.is_unc_member:
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
        is_wildcard=payload.wildcard,
        key_size=payload.key_size,
        additional_domains_raw=json.dumps([d.name for d in additional_domains]) if additional_domains else None,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    if payment:
        payment.certificate_id = certificate.id
        db.add(payment)
        db.commit()

    try:
        instructions = start_order(str(certificate.id), domain_names, domain.verification_method, key_size=payload.key_size)
    except AcmeIssuanceError as exc:
        certificate.status = "failed"
        certificate.error_message = str(exc)
        db.add(certificate)
        db.commit()
        db.refresh(certificate)
        return certificate

    # Persisted immediately (not just on success) so finalize can
    # reconstruct this order if the backend restarts before the customer
    # gets back to publish the challenge and finalize.
    certificate.challenge_items_raw = json.dumps(instructions["items"])
    certificate.acme_order_uri = instructions["order_uri"]
    certificate.csr_pem = instructions["csr_pem"]
    certificate.private_key_pem = instructions["private_key_pem"]
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    return certificate


@router.post("/{certificate_id}/finalize", response_model=CertificateOut)
def finalize_certificate(certificate_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Call once the challenge file(s)/DNS record(s) are published on the customer's domain(s)."""
    certificate = _get_owned_certificate(db, certificate_id, current_user)
    if certificate.status != "awaiting_challenge":
        raise HTTPException(status_code=400, detail=f"Certificate is not awaiting a challenge (status: {certificate.status})")

    try:
        result = finalize_order(
            str(certificate.id),
            order_uri=certificate.acme_order_uri,
            csr_pem=certificate.csr_pem,
            validation_method=certificate.validation_method,
        )
    except AcmeIssuanceError as exc:
        certificate.error_message = str(exc)
        db.add(certificate)
        db.commit()
        db.refresh(certificate)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    certificate.status = "issued"
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


@router.post("/{certificate_id}/cancel", response_model=CertificateOut)
def cancel_certificate(certificate_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    certificate = _get_owned_certificate(db, certificate_id, current_user)
    if certificate.status not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Only certificates with status in {CANCELLABLE_STATUSES} can be cancelled (current: {certificate.status})",
        )
    certificate.status = "cancelled"
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
