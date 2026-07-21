"""add booking service provider

Revision ID: d2a5b9f234e1
Revises: c1f4a8e123d0
"""
from alembic import op
import sqlalchemy as sa

revision = "d2a5b9f234e1"
down_revision = "c1f4a8e123d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bookings", sa.Column("service_provider_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_bookings_service_provider", "bookings", "users", ["service_provider_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_bookings_service_provider", "bookings", type_="foreignkey")
    op.drop_column("bookings", "service_provider_id")
