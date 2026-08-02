"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-02

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("is_email_verified", sa.Boolean, server_default=sa.false()),
        sa.Column("unc_wallet_address", sa.String(128), nullable=True),
        sa.Column("is_unc_member", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "domains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("is_verified", sa.Boolean, server_default=sa.false()),
        sa.Column("verification_method", sa.String(32), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "verification_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("domains.id"), nullable=False),
        sa.Column("method", sa.String(32), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("expected_value", sa.String(512), nullable=False),
        sa.Column("target_email", sa.String(255), nullable=True),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "certificates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("domains.id"), nullable=False),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("ca", sa.String(64), server_default="lets_encrypt"),
        sa.Column("validation_method", sa.String(32), nullable=False),
        sa.Column("challenge_target", sa.String(512), nullable=True),
        sa.Column("challenge_value", sa.Text, nullable=True),
        sa.Column("private_key_pem", sa.Text, nullable=True),
        sa.Column("csr_pem", sa.Text, nullable=True),
        sa.Column("certificate_pem", sa.Text, nullable=True),
        sa.Column("chain_pem", sa.Text, nullable=True),
        sa.Column("not_before", sa.DateTime(timezone=True), nullable=True),
        sa.Column("not_after", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("certificates")
    op.drop_table("verification_challenges")
    op.drop_table("domains")
    op.drop_table("users")
