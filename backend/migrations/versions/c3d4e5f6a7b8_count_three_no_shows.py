"""Store one no-show record per booking and require three before blocking a phone."""

from alembic import op


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_no_show_phone_bans_phone_hash", "no_show_phone_bans", type_="unique")
    op.create_unique_constraint("uq_no_show_phone_bans_booking_id", "no_show_phone_bans", ["booking_id"])


def downgrade() -> None:
    op.drop_constraint("uq_no_show_phone_bans_booking_id", "no_show_phone_bans", type_="unique")
    op.create_unique_constraint("uq_no_show_phone_bans_phone_hash", "no_show_phone_bans", ["phone_hash"])
