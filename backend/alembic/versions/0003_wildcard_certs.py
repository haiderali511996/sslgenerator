"""wildcard certificate support

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-03

"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("certificates", sa.Column("is_wildcard", sa.Boolean, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("certificates", "is_wildcard")
