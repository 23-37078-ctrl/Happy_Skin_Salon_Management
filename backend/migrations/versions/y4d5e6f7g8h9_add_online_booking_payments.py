"""Add PayMongo payment tracking for online reservations."""

from alembic import op
import sqlalchemy as sa


revision = "y4d5e6f7g8h9"
down_revision = "x3y4z5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("transactions", "staff_id", existing_type=sa.Integer(), nullable=True)
    op.create_table(
        "booking_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("provider", sa.String(30), nullable=False, server_default="paymongo"),
        sa.Column("checkout_session_id", sa.String(80), nullable=True, unique=True),
        sa.Column("checkout_url", sa.String(500), nullable=True),
        sa.Column("reference_number", sa.String(80), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="creating"),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("payment_id", sa.String(80), nullable=True, unique=True),
        sa.Column("payment_method", sa.String(30), nullable=True),
        sa.Column("guest_status_token_hash", sa.String(64), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("booking_payments")
    op.alter_column("transactions", "staff_id", existing_type=sa.Integer(), nullable=False)
