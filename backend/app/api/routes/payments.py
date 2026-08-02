from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import Domain
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentOut, PaymentSubmit
from app.services import unc_chain

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("", response_model=list[PaymentOut])
def list_payments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Payment).filter(Payment.user_id == current_user.id).order_by(Payment.created_at.desc()).all()


@router.post("/unc/submit", response_model=PaymentOut, status_code=201)
def submit_unc_payment(payload: PaymentSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.unc_wallet_address:
        raise HTTPException(status_code=400, detail="Link your UNC wallet before submitting a payment")

    domain = db.get(Domain, payload.domain_id)
    if not domain or domain.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Domain not found")

    existing = db.query(Payment).filter(Payment.tx_hash == payload.tx_hash).first()
    if existing:
        raise HTTPException(status_code=400, detail="This transaction has already been submitted")

    payment = Payment(
        user_id=current_user.id,
        domain_id=domain.id,
        tx_hash=payload.tx_hash,
        amount=Decimal(str(settings.unc_cert_price)),
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    try:
        result = unc_chain.verify_native_payment(
            tx_hash=payload.tx_hash,
            expected_from=current_user.unc_wallet_address,
            expected_amount=Decimal(str(settings.unc_cert_price)),
        )
    except unc_chain.ChainUnavailableError as exc:
        payment.status = "failed"
        payment.error_message = str(exc)
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    if result.success:
        payment.status = "confirmed"
        payment.amount = result.amount
        payment.confirmed_at = datetime.utcnow()
    else:
        payment.status = "failed"
        payment.error_message = result.reason

    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
