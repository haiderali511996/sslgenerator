"""email verification

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-14

"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verification_code", sa.String(6), nullable=True))
    op.add_column("users", sa.Column("email_verification_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "email_verification_sent_at")
    op.drop_column("users", "email_verification_code")
