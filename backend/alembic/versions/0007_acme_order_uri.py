"""persist ACME order URI for restart-safe finalization

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-15

"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("certificates", sa.Column("acme_order_uri", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("certificates", "acme_order_uri")
