import uuid
from datetime import datetime

from pydantic import BaseModel


class CertificateRequest(BaseModel):
    domain_id: uuid.UUID
    wildcard: bool = False


class CertificateOut(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    status: str
    ca: str
    validation_method: str
    is_wildcard: bool
    challenge_target: str | None
    challenge_values: list[str]
    not_before: datetime | None
    not_after: datetime | None
    error_message: str | None
    created_at: datetime
    issued_at: datetime | None

    class Config:
        from_attributes = True


class CertificateDownload(BaseModel):
    certificate_pem: str
    chain_pem: str | None
    private_key_pem: str


class SslCheckRequest(BaseModel):
    host: str
    port: int = 443


class SslCheckResult(BaseModel):
    host: str
    port: int
    is_valid: bool
    issuer: str | None
    subject: str | None
    not_before: datetime | None
    not_after: datetime | None
    days_until_expiry: int | None
    protocol_version: str | None
    san: list[str] = []
    warnings: list[str] = []
    error: str | None = None
