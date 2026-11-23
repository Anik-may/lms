"""drop instructor verification

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-23 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("instructor_verifications")
    op.drop_column("instructor_profiles", "verified_at")
    op.drop_column("instructor_profiles", "verification_status")


def downgrade() -> None:
    op.add_column(
        "instructor_profiles",
        sa.Column("verification_status", sa.String(length=30), server_default="UNVERIFIED", nullable=False),
    )
    op.add_column("instructor_profiles", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "instructor_verifications",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("verification_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="PENDING", nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["instructor_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
