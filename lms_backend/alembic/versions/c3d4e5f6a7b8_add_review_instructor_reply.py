"""add instructor reply to reviews

Revision ID: c3d4e5f6a7b8
Revises: b7c1d2e3f4a5
Create Date: 2026-11-18 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reviews", sa.Column("instructor_reply", sa.Text(), nullable=True))
    op.add_column("reviews", sa.Column("instructor_reply_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "reviews",
        sa.Column(
            "instructor_reply_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_reviews_instructor_reply_by"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_constraint("fk_reviews_instructor_reply_by", "reviews", type_="foreignkey")
    op.drop_column("reviews", "instructor_reply_by")
    op.drop_column("reviews", "instructor_reply_at")
    op.drop_column("reviews", "instructor_reply")
