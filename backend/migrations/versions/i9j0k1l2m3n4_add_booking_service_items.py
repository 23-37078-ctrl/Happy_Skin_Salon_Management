"""add booking service items

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""
import sqlalchemy as sa
from alembic import op

revision = "i9j0k1l2m3n4"
down_revision = "1e1782292e82"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("booking_service_items", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False), sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id"), nullable=False), sa.Column("service_provider_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_booking_service_items_booking_id", "booking_service_items", ["booking_id"])
    op.execute("INSERT INTO booking_service_items (booking_id, service_id, service_provider_id) SELECT id, service_id, service_provider_id FROM bookings")

def downgrade():
    op.drop_index("ix_booking_service_items_booking_id", table_name="booking_service_items")
    op.drop_table("booking_service_items")
