"""Hold new social signups until SMS phone verification completes."""

from alembic import op
import sqlalchemy as sa


revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "social_phone_challenges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("provider", "provider_id", name="uq_social_phone_provider_identity"),
    )


def downgrade():
    op.drop_table("social_phone_challenges")
