"""Add branch-specific service offerings.

Revision ID: e7b1c4d9a203
Revises: f4a8c2d1e901
Create Date: 2026-07-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e7b1c4d9a203"
down_revision: Union[str, Sequence[str], None] = "f4a8c2d1e901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "branch_services",
        sa.Column("branch_id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("branch_id", "service_id"),
    )


def downgrade() -> None:
    op.drop_table("branch_services")
