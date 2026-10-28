"""Add isolated staging tables for synthetic dataset imports."""

from alembic import op
import sqlalchemy as sa


revision = "p5q6r7s8t9u0"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This revision follows the current migration graph head. Keep the records
    # isolated from operational bookings, users, and transactions.
    op.create_table(
        "synthetic_import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_sha256", sa.String(64), nullable=False, unique=True),
        sa.Column("source_name", sa.String(255), nullable=False),
        sa.Column("validation_report", sa.JSON(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table("synthetic_branches",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("batch_id", sa.Integer(), sa.ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("synthetic_id", sa.String(40), nullable=False), sa.Column("name", sa.String(100), nullable=False),
        sa.UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_branch_batch_id"))
    op.create_index("ix_synthetic_branches_batch_id", "synthetic_branches", ["batch_id"])
    op.create_table("synthetic_services",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("batch_id", sa.Integer(), sa.ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("synthetic_id", sa.Integer(), nullable=False), sa.Column("name", sa.String(100), nullable=False), sa.Column("price", sa.Float(), nullable=False), sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_service_batch_id"))
    op.create_index("ix_synthetic_services_batch_id", "synthetic_services", ["batch_id"])
    op.create_table("synthetic_appointments",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("batch_id", sa.Integer(), sa.ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("synthetic_id", sa.String(40), nullable=False), sa.Column("branch_id", sa.String(40), nullable=False), sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("appointment_date", sa.DateTime(), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("customer_synthetic_id", sa.String(40), nullable=False), sa.Column("staff_synthetic_id", sa.String(40), nullable=False),
        sa.UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_appointment_batch_id"))
    op.create_index("ix_synthetic_appointments_batch_id", "synthetic_appointments", ["batch_id"])
    op.create_index("ix_synthetic_appointment_batch_branch_date", "synthetic_appointments", ["batch_id", "branch_id", "appointment_date"])
    op.create_table("synthetic_transactions",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("batch_id", sa.Integer(), sa.ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("synthetic_id", sa.String(40), nullable=False), sa.Column("appointment_synthetic_id", sa.String(40), nullable=False), sa.Column("branch_id", sa.String(40), nullable=False),
        sa.Column("transaction_date", sa.DateTime(), nullable=False), sa.Column("subtotal", sa.Float(), nullable=False), sa.Column("discount", sa.Float(), nullable=False), sa.Column("total", sa.Float(), nullable=False), sa.Column("payment_method", sa.String(30), nullable=False),
        sa.UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_transaction_batch_id"))
    op.create_index("ix_synthetic_transactions_batch_id", "synthetic_transactions", ["batch_id"])
    op.create_index("ix_synthetic_transactions_appointment_synthetic_id", "synthetic_transactions", ["appointment_synthetic_id"])
    op.create_table("synthetic_transaction_items",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("batch_id", sa.Integer(), sa.ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("synthetic_id", sa.String(50), nullable=False), sa.Column("transaction_synthetic_id", sa.String(40), nullable=False), sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False), sa.Column("unit_price", sa.Float(), nullable=False), sa.Column("discount", sa.Float(), nullable=False), sa.Column("line_total", sa.Float(), nullable=False),
        sa.UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_item_batch_id"))
    op.create_index("ix_synthetic_transaction_items_batch_id", "synthetic_transaction_items", ["batch_id"])
    op.create_index("ix_synthetic_item_batch_transaction", "synthetic_transaction_items", ["batch_id", "transaction_synthetic_id"])
    op.create_table("synthetic_daily_forecasts",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("batch_id", sa.Integer(), sa.ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("forecast_date", sa.Date(), nullable=False), sa.Column("branch_id", sa.String(40), nullable=False), sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("bookings", sa.Integer(), nullable=False), sa.Column("completed_bookings", sa.Integer(), nullable=False), sa.Column("cancelled_bookings", sa.Integer(), nullable=False), sa.Column("no_show_bookings", sa.Integer(), nullable=False), sa.Column("daily_revenue", sa.Float(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False), sa.Column("is_weekend", sa.Boolean(), nullable=False), sa.Column("month", sa.Integer(), nullable=False), sa.Column("year", sa.Integer(), nullable=False),
        sa.UniqueConstraint("batch_id", "forecast_date", "branch_id", "service_id", name="uq_synthetic_daily_forecast_key"))
    op.create_index("ix_synthetic_daily_forecasts_batch_id", "synthetic_daily_forecasts", ["batch_id"])
    op.create_index("ix_synthetic_daily_forecast_filter", "synthetic_daily_forecasts", ["batch_id", "branch_id", "service_id", "forecast_date"])


def downgrade() -> None:
    op.drop_table("synthetic_daily_forecasts")
    op.drop_table("synthetic_transaction_items")
    op.drop_table("synthetic_transactions")
    op.drop_table("synthetic_appointments")
    op.drop_table("synthetic_services")
    op.drop_table("synthetic_branches")
    op.drop_table("synthetic_import_batches")
