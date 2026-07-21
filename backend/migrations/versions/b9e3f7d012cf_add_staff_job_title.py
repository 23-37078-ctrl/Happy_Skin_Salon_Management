"""add staff job title

Revision ID: b9e3f7d012cf
Revises: a8f2d6c901be
"""
from alembic import op
import sqlalchemy as sa

revision = "b9e3f7d012cf"
down_revision = "a8f2d6c901be"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("job_title", sa.String(length=80), nullable=True))


def downgrade():
    op.drop_column("users", "job_title")
