import json
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("domains.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(32), default="pending")
    # pending, awaiting_challenge, issuing, issued, failed, expired, revoked, cancelled

    ca: Mapped[str] = mapped_column(String(64), default="lets_encrypt")
    validation_method: Mapped[str] = mapped_column(String(32), nullable=False)
    is_wildcard: Mapped[bool] = mapped_column(Boolean, default=False)
    key_size: Mapped[int] = mapped_column(Integer, default=2048)

    # JSON list of extra SAN domain names beyond the primary `domain`, e.g. ["api.example.com"]
    additional_domains_raw: Mapped[str | None] = mapped_column("additional_domains", Text, nullable=True)

    # JSON list of per-domain challenge instructions: [{domain, url_path|record_name, content|record_value}]
    challenge_items_raw: Mapped[str | None] = mapped_column("challenge_items", Text, nullable=True)

    # ACME order URL, saved as soon as the order is created so finalize can
    # reconstruct the order (re-fetch it and re-derive the challenges) if
    # the backend process restarted and lost the in-memory pending-order
    # state — restarts are routine in production (deploys, crash recovery),
    # and this is the fix, not a case to just document as a limitation.
    acme_order_uri: Mapped[str | None] = mapped_column(Text, nullable=True)

    private_key_pem: Mapped[str | None] = mapped_column(Text, nullable=True)
    csr_pem: Mapped[str | None] = mapped_column(Text, nullable=True)
    certificate_pem: Mapped[str | None] = mapped_column(Text, nullable=True)
    chain_pem: Mapped[str | None] = mapped_column(Text, nullable=True)

    not_before: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    not_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    domain = relationship("Domain", back_populates="certificates")

    @property
    def additional_domains(self) -> list[str]:
        return _load_json_list(self.additional_domains_raw)

    @property
    def challenge_items(self) -> list[dict]:
        if not self.challenge_items_raw:
            return []
        try:
            return json.loads(self.challenge_items_raw)
        except (json.JSONDecodeError, TypeError):
            return []


def _load_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []
