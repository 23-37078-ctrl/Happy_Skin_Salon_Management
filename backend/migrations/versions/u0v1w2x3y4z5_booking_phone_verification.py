"""Add one-time phone verification for public bookings."""

from alembic import op
import sqlalchemy as sa


revision = "u0v1w2x3y4z5"
down_revision = "t9u0v1w2x3y4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "booking_phone_verifications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_booking_phone_verifications_phone_number",
        "booking_phone_verifications",
        ["phone_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_booking_phone_verifications_phone_number", table_name="booking_phone_verifications")
    op.drop_table("booking_phone_verifications")
