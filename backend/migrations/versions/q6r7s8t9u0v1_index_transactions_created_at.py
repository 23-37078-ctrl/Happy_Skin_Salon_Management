"""Index transaction timestamps for date-based ledger queries."""

from alembic import op


revision = "q6r7s8t9u0v1"
down_revision = "p5q6r7s8t9u0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_transactions_created_at", "transactions", ["created_at"])


def downgrade():
    op.drop_index("ix_transactions_created_at", table_name="transactions")
