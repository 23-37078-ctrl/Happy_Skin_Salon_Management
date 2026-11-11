"""Record online booking refunds and net refunded transaction amounts."""

from alembic import op
import sqlalchemy as sa


revision = "4b5c6d7e8f90"
down_revision = "3a9f1c7d2b4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_payments", sa.Column("refund_id", sa.String(length=80), nullable=True))
    op.add_column("booking_payments", sa.Column("refund_reference", sa.String(length=80), nullable=True))
    op.add_column("booking_payments", sa.Column("refund_reason", sa.String(length=255), nullable=True))
    op.add_column("booking_payments", sa.Column("refunded_by_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_booking_payments_refunded_by_id_users", "booking_payments", "users", ["refunded_by_id"], ["id"])
    op.add_column("booking_payments", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transactions", sa.Column("refunded_amount", sa.Float(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("transactions", "refunded_amount")
    op.drop_column("booking_payments", "refunded_at")
    op.drop_constraint("fk_booking_payments_refunded_by_id_users", "booking_payments", type_="foreignkey")
    op.drop_column("booking_payments", "refunded_by_id")
    op.drop_column("booking_payments", "refund_reason")
    op.drop_column("booking_payments", "refund_reference")
    op.drop_column("booking_payments", "refund_id")
