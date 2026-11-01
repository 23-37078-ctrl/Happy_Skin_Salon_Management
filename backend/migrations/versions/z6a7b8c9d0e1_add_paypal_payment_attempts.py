"""Track individual PayPal order attempts without changing transaction uniqueness."""

from alembic import op
import sqlalchemy as sa


revision = "z6a7b8c9d0e1"
down_revision = "y4d5e6f7g8h9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "booking_payments",
        "provider",
        existing_type=sa.String(length=30),
        existing_nullable=False,
        existing_server_default="paymongo",
        server_default="paypal",
    )
    op.create_table(
        "booking_payment_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "booking_payment_id",
            sa.Integer(),
            sa.ForeignKey("booking_payments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("paypal_order_id", sa.String(length=80), nullable=True),
        sa.Column("paypal_capture_id", sa.String(length=80), nullable=True),
        sa.Column("create_request_id", sa.String(length=80), nullable=False),
        sa.Column("capture_request_id", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="creating"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="PHP"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("paypal_order_id", name="uq_booking_payment_attempts_order"),
        sa.UniqueConstraint("paypal_capture_id", name="uq_booking_payment_attempts_capture"),
        sa.UniqueConstraint("create_request_id", name="uq_booking_payment_attempts_create_request"),
        sa.UniqueConstraint("capture_request_id", name="uq_booking_payment_attempts_capture_request"),
    )
    op.create_index(
        "ix_booking_payment_attempts_booking_payment_id",
        "booking_payment_attempts",
        ["booking_payment_id"],
    )
    op.create_index(
        "ix_booking_payment_attempts_payment_status",
        "booking_payment_attempts",
        ["booking_payment_id", "status"],
    )

    # Payment-attempt rows are read and written only by FastAPI through the
    # database connection. They are not a public Supabase Data API surface.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE booking_payment_attempts ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE booking_payment_attempts DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_booking_payment_attempts_payment_status", table_name="booking_payment_attempts")
    op.drop_index("ix_booking_payment_attempts_booking_payment_id", table_name="booking_payment_attempts")
    op.drop_table("booking_payment_attempts")
    op.alter_column(
        "booking_payments",
        "provider",
        existing_type=sa.String(length=30),
        existing_nullable=False,
        existing_server_default="paypal",
        server_default="paymongo",
    )
