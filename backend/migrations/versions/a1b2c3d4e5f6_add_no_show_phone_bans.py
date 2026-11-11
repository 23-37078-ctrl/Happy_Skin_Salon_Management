"""Add phone-level bans for paid online booking no-shows."""

from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "no_show_phone_bans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone_hash", sa.String(length=64), nullable=False),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("phone_hash", name="uq_no_show_phone_bans_phone_hash"),
    )


def downgrade() -> None:
    op.drop_table("no_show_phone_bans")
