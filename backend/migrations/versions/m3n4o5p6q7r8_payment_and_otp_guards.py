"""Payment uniqueness/idempotency and OTP attempt limits.

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
"""

from alembic import op
import sqlalchemy as sa

revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    duplicate = bind.execute(sa.text(
        "SELECT booking_id, COUNT(*) AS total FROM transactions "
        "GROUP BY booking_id HAVING COUNT(*) > 1 LIMIT 1"
    )).first()
    if duplicate:
        raise RuntimeError(
            "Cannot enforce one payment per booking: duplicate transaction rows "
            f"exist for booking {duplicate.booking_id}. Reconcile before migrating."
        )

    op.add_column("transactions", sa.Column("idempotency_key", sa.String(80), nullable=True))
    op.create_unique_constraint("uq_transactions_booking_id", "transactions", ["booking_id"])
    op.create_unique_constraint("uq_transactions_idempotency_key", "transactions", ["idempotency_key"])
    op.add_column("users", sa.Column("verification_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("users", "verification_attempts", server_default=None)
    op.add_column("users", sa.Column("verification_code_started_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("users", "verification_code_started_at")
    op.drop_column("users", "verification_attempts")
    op.drop_constraint("uq_transactions_idempotency_key", "transactions", type_="unique")
    op.drop_constraint("uq_transactions_booking_id", "transactions", type_="unique")
    op.drop_column("transactions", "idempotency_key")
