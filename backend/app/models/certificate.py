import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("domains.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(32), default="pending")
    # pending, awaiting_challenge, issuing, issued, failed, expired, revoked

    ca: Mapped[str] = mapped_column(String(64), default="lets_encrypt")
    validation_method: Mapped[str] = mapped_column(String(32), nullable=False)

    challenge_target: Mapped[str | None] = mapped_column(String(512), nullable=True)
    challenge_value: Mapped[str | None] = mapped_column(Text, nullable=True)

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
