"""multi-domain SAN certs + key size

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-14

"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("certificates", sa.Column("key_size", sa.Integer, server_default="2048"))
    op.add_column("certificates", sa.Column("additional_domains", sa.Text, nullable=True))
    op.add_column("certificates", sa.Column("challenge_items", sa.Text, nullable=True))

    op.execute(
        """
        UPDATE certificates
        SET challenge_items = json_build_array(
            json_build_object('domain', NULL, 'url_path', challenge_target, 'content', challenge_value)
        )::text
        WHERE challenge_target IS NOT NULL
        """
    )

    op.drop_column("certificates", "challenge_target")
    op.drop_column("certificates", "challenge_value")


def downgrade() -> None:
    op.add_column("certificates", sa.Column("challenge_target", sa.String(512), nullable=True))
    op.add_column("certificates", sa.Column("challenge_value", sa.Text, nullable=True))
    op.drop_column("certificates", "challenge_items")
    op.drop_column("certificates", "additional_domains")
    op.drop_column("certificates", "key_size")
