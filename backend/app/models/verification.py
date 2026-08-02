import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class VerificationChallenge(Base):
    __tablename__ = "verification_challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("domains.id"), nullable=False)

    method: Mapped[str] = mapped_column(String(32), nullable=False)  # http, dns, email
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    expected_value: Mapped[str] = mapped_column(String(512), nullable=False)
    target_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, verified, failed, expired
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    domain = relationship("Domain", back_populates="challenges")
