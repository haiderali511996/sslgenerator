import uuid
from datetime import datetime

from pydantic import BaseModel


class PaymentSubmit(BaseModel):
    domain_id: uuid.UUID
    tx_hash: str


class PaymentOut(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    certificate_id: uuid.UUID | None
    tx_hash: str
    amount: float
    status: str
    error_message: str | None
    created_at: datetime
    confirmed_at: datetime | None

    class Config:
        from_attributes = True
