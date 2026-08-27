"""add day closures

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
"""

from alembic import op
import sqlalchemy as sa

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "day_closures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_date", sa.Date(), nullable=False),
        sa.Column("closed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("closed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("branch_id", "business_date", name="uq_day_closure_branch_date"),
    )
    op.create_index("ix_day_closures_branch_id", "day_closures", ["branch_id"])
    op.create_index("ix_day_closures_business_date", "day_closures", ["business_date"])


def downgrade():
    op.drop_index("ix_day_closures_business_date", table_name="day_closures")
    op.drop_index("ix_day_closures_branch_id", table_name="day_closures")
    op.drop_table("day_closures")
