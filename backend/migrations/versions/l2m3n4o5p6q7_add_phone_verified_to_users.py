"""add phone verification state to users

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
"""

import sqlalchemy as sa
from alembic import op


revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("users", "phone_verified", server_default=None)


def downgrade():
    op.drop_column("users", "phone_verified")
