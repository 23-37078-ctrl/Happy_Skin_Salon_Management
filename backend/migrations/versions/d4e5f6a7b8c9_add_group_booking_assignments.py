"""Add group member and per-service booking assignment details."""

from alembic import op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "4b5c6d7e8f90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("group_reference", sa.String(length=32), nullable=True))
    op.create_index("ix_bookings_group_reference", "bookings", ["group_reference"], unique=True)
    op.create_table(
        "group_booking_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_name", sa.String(length=100), nullable=False),
        sa.Column("contact_number", sa.String(length=20), nullable=True),
        sa.Column("is_booker", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_group_booking_members_booking_id", "group_booking_members", ["booking_id"])
    op.add_column("booking_service_items", sa.Column("member_id", sa.Integer(), sa.ForeignKey("group_booking_members.id", ondelete="CASCADE"), nullable=True))
    op.add_column("booking_service_items", sa.Column("appointment_start", sa.DateTime(timezone=True), nullable=True))
    op.add_column("booking_service_items", sa.Column("appointment_end", sa.DateTime(timezone=True), nullable=True))
    op.add_column("booking_service_items", sa.Column("service_price", sa.Float(), nullable=True))
    op.add_column("booking_service_items", sa.Column("service_duration_minutes", sa.Integer(), nullable=True))
    op.add_column("booking_service_items", sa.Column("status", sa.String(length=20), server_default="pending", nullable=False))
    op.create_index("ix_booking_service_items_member_id", "booking_service_items", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_service_items_member_id", table_name="booking_service_items")
    op.drop_column("booking_service_items", "status")
    op.drop_column("booking_service_items", "service_price")
    op.drop_column("booking_service_items", "service_duration_minutes")
    op.drop_column("booking_service_items", "appointment_end")
    op.drop_column("booking_service_items", "appointment_start")
    op.drop_column("booking_service_items", "member_id")
    op.drop_index("ix_group_booking_members_booking_id", table_name="group_booking_members")
    op.drop_table("group_booking_members")
    op.drop_index("ix_bookings_group_reference", table_name="bookings")
    op.drop_column("bookings", "group_reference")
