"""add booking provider preference

Revision ID: f6c4a1b8d205
Revises: d2a5b9f234e1
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa


revision = "f6c4a1b8d205"
down_revision = "d2a5b9f234e1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "bookings",
        sa.Column("preferred_service_provider_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_bookings_preferred_service_provider",
        "bookings",
        "users",
        ["preferred_service_provider_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_bookings_preferred_service_provider_id",
        "bookings",
        ["preferred_service_provider_id"],
    )


def downgrade():
    op.drop_index("ix_bookings_preferred_service_provider_id", table_name="bookings")
    op.drop_constraint("fk_bookings_preferred_service_provider", "bookings", type_="foreignkey")
    op.drop_column("bookings", "preferred_service_provider_id")
