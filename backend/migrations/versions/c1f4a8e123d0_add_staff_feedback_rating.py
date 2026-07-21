"""add staff feedback rating

Revision ID: c1f4a8e123d0
Revises: b9e3f7d012cf
"""
from alembic import op
import sqlalchemy as sa

revision = "c1f4a8e123d0"
down_revision = "b9e3f7d012cf"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("feedback", sa.Column("service_provider_id", sa.Integer(), nullable=True))
    op.add_column("feedback", sa.Column("staff_rating", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_feedback_service_provider", "feedback", "users", ["service_provider_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_feedback_service_provider", "feedback", type_="foreignkey")
    op.drop_column("feedback", "staff_rating")
    op.drop_column("feedback", "service_provider_id")
