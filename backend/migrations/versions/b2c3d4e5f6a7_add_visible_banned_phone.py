"""Store mobile number for branch-scoped staff no-show review."""

from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("no_show_phone_bans", sa.Column("phone_number", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("no_show_phone_bans", "phone_number")
