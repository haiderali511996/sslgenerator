"""wallet linking + UNC payments

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-03

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("unc_wallet_nonce", sa.String(64), nullable=True))

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("domains.id"), nullable=False),
        sa.Column("certificate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("certificates.id"), nullable=True),
        sa.Column("tx_hash", sa.String(128), nullable=False, unique=True, index=True),
        sa.Column("amount", sa.Numeric(36, 18), nullable=False),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_column("users", "unc_wallet_nonce")
