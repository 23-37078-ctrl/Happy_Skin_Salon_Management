"""Add customer profile photo URL."""

from alembic import op
import sqlalchemy as sa


revision = "w2x3y4z5a6b7"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_image_url")
