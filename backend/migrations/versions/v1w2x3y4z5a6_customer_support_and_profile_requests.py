"""Add customer-manager support chat and profile change approvals."""

from alembic import op
import sqlalchemy as sa


revision = "v1w2x3y4z5a6"
down_revision = "u0v1w2x3y4z5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_support_threads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_customer_support_threads_customer_id", "customer_support_threads", ["customer_id"])
    op.create_index("ix_customer_support_threads_branch_id", "customer_support_threads", ["branch_id"])
    op.create_index("ix_customer_support_threads_status", "customer_support_threads", ["status"])

    op.create_table(
        "customer_support_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thread_id", sa.Integer(), sa.ForeignKey("customer_support_threads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_role", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_customer_support_messages_thread_id", "customer_support_messages", ["thread_id"])
    op.create_index("ix_customer_support_messages_sender_id", "customer_support_messages", ["sender_id"])
    op.create_index("ix_customer_support_messages_created_at", "customer_support_messages", ["created_at"])

    op.create_table(
        "customer_profile_change_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field", sa.String(length=20), nullable=False),
        sa.Column("current_value", sa.String(length=255), nullable=True),
        sa.Column("requested_value", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("manager_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_customer_profile_change_customer", "customer_profile_change_requests", ["customer_id"])
    op.create_index("ix_customer_profile_change_branch", "customer_profile_change_requests", ["branch_id"])
    op.create_index("ix_customer_profile_change_status", "customer_profile_change_requests", ["status"])
    op.create_index("ix_customer_profile_change_created", "customer_profile_change_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_customer_profile_change_created", table_name="customer_profile_change_requests")
    op.drop_index("ix_customer_profile_change_status", table_name="customer_profile_change_requests")
    op.drop_index("ix_customer_profile_change_branch", table_name="customer_profile_change_requests")
    op.drop_index("ix_customer_profile_change_customer", table_name="customer_profile_change_requests")
    op.drop_table("customer_profile_change_requests")
    op.drop_index("ix_customer_support_messages_created_at", table_name="customer_support_messages")
    op.drop_index("ix_customer_support_messages_sender_id", table_name="customer_support_messages")
    op.drop_index("ix_customer_support_messages_thread_id", table_name="customer_support_messages")
    op.drop_table("customer_support_messages")
    op.drop_index("ix_customer_support_threads_status", table_name="customer_support_threads")
    op.drop_index("ix_customer_support_threads_branch_id", table_name="customer_support_threads")
    op.drop_index("ix_customer_support_threads_customer_id", table_name="customer_support_threads")
    op.drop_table("customer_support_threads")
