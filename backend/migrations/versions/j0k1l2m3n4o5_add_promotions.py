"""add promotions

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
"""

from alembic import op
import sqlalchemy as sa


revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "promotions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("subtitle", sa.String(length=80), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )
    op.create_index("ix_promotions_branch_id", "promotions", ["branch_id"])
    op.create_index("ix_promotions_start_date", "promotions", ["start_date"])
    op.create_index("ix_promotions_end_date", "promotions", ["end_date"])


def downgrade():
    op.drop_index("ix_promotions_end_date", table_name="promotions")
    op.drop_index("ix_promotions_start_date", table_name="promotions")
    op.drop_index("ix_promotions_branch_id", table_name="promotions")
    op.drop_table("promotions")
