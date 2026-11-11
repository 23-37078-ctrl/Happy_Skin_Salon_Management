"""Add GCash proof submissions and staff verification history."""

from alembic import op
import sqlalchemy as sa

revision = "a1c2e3f4g5h6"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_payments", sa.Column("verified_by_id", sa.Integer(), nullable=True))
    op.add_column("booking_payments", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("booking_payments", sa.Column("decision_remarks", sa.String(length=1000), nullable=True))
    op.create_foreign_key("fk_booking_payments_verified_by", "booking_payments", "users", ["verified_by_id"], ["id"])
    op.create_table(
        "gcash_payment_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_payment_id", sa.Integer(), sa.ForeignKey("booking_payments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference_number", sa.String(80), nullable=False),
        sa.Column("reported_paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("proof_path", sa.String(500), nullable=False),
        sa.Column("proof_content_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="for_verification"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision", sa.String(20), nullable=True),
        sa.Column("remarks", sa.String(1000), nullable=True),
        sa.UniqueConstraint("reference_number", name="uq_gcash_submission_reference"),
    )
    op.create_index("ix_gcash_payment_submissions_booking_payment_id", "gcash_payment_submissions", ["booking_payment_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE gcash_payment_submissions ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE gcash_payment_submissions DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_gcash_payment_submissions_booking_payment_id", table_name="gcash_payment_submissions")
    op.drop_table("gcash_payment_submissions")
    op.drop_constraint("fk_booking_payments_verified_by", "booking_payments", type_="foreignkey")
    op.drop_column("booking_payments", "decision_remarks")
    op.drop_column("booking_payments", "verified_at")
    op.drop_column("booking_payments", "verified_by_id")
