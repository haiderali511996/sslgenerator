import uuid

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.domain import Domain
from app.models.user import User
from app.models.verification import VerificationChallenge
from app.schemas.domain import DomainCreate, DomainOut, VerificationChallengeOut, VerificationStart
from app.services import verification_service

router = APIRouter(prefix="/api/domains", tags=["domains"])


def _get_owned_domain(db: Session, domain_id: uuid.UUID, user: User) -> Domain:
    domain = db.get(Domain, domain_id)
    if not domain or domain.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.get("", response_model=list[DomainOut])
def list_domains(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Domain).filter(Domain.owner_id == current_user.id).order_by(Domain.created_at.desc()).all()


@router.post("", response_model=DomainOut, status_code=201)
def create_domain(payload: DomainCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = payload.name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Domain name is required")

    domain = Domain(owner_id=current_user.id, name=name)
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@router.post("/{domain_id}/verify/start", response_model=VerificationChallengeOut)
def start_verification(
    domain_id: uuid.UUID,
    payload: VerificationStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = _get_owned_domain(db, domain_id, current_user)
    try:
        challenge = verification_service.start_verification(db, domain, payload.method, payload.target_email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return challenge


@router.post("/{domain_id}/verify/{challenge_id}/check", response_model=VerificationChallengeOut)
def check_verification(
    domain_id: uuid.UUID,
    challenge_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    code: str | None = Body(default=None, embed=True),
):
    domain = _get_owned_domain(db, domain_id, current_user)
    challenge = db.get(VerificationChallenge, challenge_id)
    if not challenge or challenge.domain_id != domain.id:
        raise HTTPException(status_code=404, detail="Verification challenge not found")

    if challenge.status != "verified":
        verification_service.check_verification(db, challenge, domain, submitted_code=code)
        db.refresh(challenge)

    return challenge
