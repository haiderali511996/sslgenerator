import uuid
from datetime import datetime

from pydantic import BaseModel


class ChallengeItem(BaseModel):
    domain: str
    url_path: str | None = None
    content: str | None = None
    record_name: str | None = None
    record_value: str | None = None


class CertificateRequest(BaseModel):
    domain_id: uuid.UUID
    wildcard: bool = False
    additional_domain_ids: list[uuid.UUID] = []
    key_size: int = 2048


class CertificateOut(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    status: str
    ca: str
    validation_method: str
    is_wildcard: bool
    key_size: int
    additional_domains: list[str]
    challenge_items: list[ChallengeItem]
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
