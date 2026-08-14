import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import EmailVerificationConfirm, TokenOut, UserCreate, UserLogin, UserOut
from app.services.email_service import send_signup_verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

VERIFICATION_RESEND_COOLDOWN = timedelta(seconds=60)


def _send_verification_code(db: Session, user: User) -> None:
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    user.email_verification_code = code
    user.email_verification_sent_at = datetime.utcnow()
    db.add(user)
    db.commit()
    try:
        send_signup_verification_email(user.email, code)
    except Exception:  # noqa: BLE001 - SMTP may not be configured yet; don't block signup on it
        pass


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        unc_wallet_address=payload.unc_wallet_address,
        is_unc_member=bool(payload.unc_wallet_address),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _send_verification_code(db, user)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/verify-email/request", status_code=204)
def request_email_verification(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")
    if current_user.email_verification_sent_at:
        elapsed = datetime.utcnow() - current_user.email_verification_sent_at
        if elapsed < VERIFICATION_RESEND_COOLDOWN:
            wait = int((VERIFICATION_RESEND_COOLDOWN - elapsed).total_seconds())
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code")
    _send_verification_code(db, current_user)


@router.post("/verify-email/confirm", response_model=UserOut)
def confirm_email_verification(
    payload: EmailVerificationConfirm, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if current_user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")
    if not current_user.email_verification_code or not secrets.compare_digest(payload.code, current_user.email_verification_code):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    current_user.is_email_verified = True
    current_user.email_verification_code = None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
