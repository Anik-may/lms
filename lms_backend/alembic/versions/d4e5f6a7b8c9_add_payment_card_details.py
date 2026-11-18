"""add card brand and last4 to payments

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-18 12:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("card_brand", sa.String(20), nullable=True))
    op.add_column("payments", sa.Column("card_last4", sa.String(4), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "card_last4")
    op.drop_column("payments", "card_brand")
