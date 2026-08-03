"""API keys for REST automation

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-03

"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("api_key_hash", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("api_key_prefix", sa.String(12), nullable=True))
    op.add_column("users", sa.Column("api_key_created_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_api_key_hash", "users", ["api_key_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_api_key_hash", table_name="users")
    op.drop_column("users", "api_key_created_at")
    op.drop_column("users", "api_key_prefix")
    op.drop_column("users", "api_key_hash")
