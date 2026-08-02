import uuid
from datetime import datetime

from pydantic import BaseModel


class DomainCreate(BaseModel):
    name: str


class DomainOut(BaseModel):
    id: uuid.UUID
    name: str
    is_verified: bool
    verification_method: str | None
    verified_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationStart(BaseModel):
    method: str  # http | dns | email
    target_email: str | None = None


class VerificationChallengeOut(BaseModel):
    id: uuid.UUID
    method: str
    token: str
    expected_value: str
    status: str
    target_email: str | None

    class Config:
        from_attributes = True
