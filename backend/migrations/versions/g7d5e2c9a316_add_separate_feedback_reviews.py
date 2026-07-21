"""add separate service staff and branch feedback

Revision ID: g7d5e2c9a316
Revises: f6c4a1b8d205
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa


revision = "g7d5e2c9a316"
down_revision = "f6c4a1b8d205"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("feedback", sa.Column("staff_review", sa.Text(), nullable=True))
    op.add_column("feedback", sa.Column("branch_rating", sa.Integer(), nullable=True))
    op.add_column("feedback", sa.Column("branch_review", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("feedback", "branch_review")
    op.drop_column("feedback", "branch_rating")
    op.drop_column("feedback", "staff_review")
