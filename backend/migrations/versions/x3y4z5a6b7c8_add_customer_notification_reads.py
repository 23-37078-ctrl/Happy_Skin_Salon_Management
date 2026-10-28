"""Persist customer notification read status."""

from alembic import op
import sqlalchemy as sa


revision = "x3y4z5a6b7c8"
down_revision = "w2x3y4z5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_notification_reads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_id", sa.String(length=100), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("customer_id", "notification_id", name="uq_customer_notification_read"),
    )
    op.create_index("ix_customer_notification_reads_customer_id", "customer_notification_reads", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_notification_reads_customer_id", table_name="customer_notification_reads")
    op.drop_table("customer_notification_reads")
