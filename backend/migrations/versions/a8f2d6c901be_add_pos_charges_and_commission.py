"""add POS charges and service-provider commission

Revision ID: a8f2d6c901be
Revises: e7b1c4d9a203
"""
from alembic import op
import sqlalchemy as sa

revision = "a8f2d6c901be"
down_revision = "e7b1c4d9a203"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transactions", sa.Column("service_provider_id", sa.Integer(), nullable=True))
    op.add_column("transactions", sa.Column("additional_charge", sa.Float(), nullable=False, server_default="0"))
    op.add_column("transactions", sa.Column("charge_reason", sa.String(length=150), nullable=True))
    op.add_column("transactions", sa.Column("commission_rate", sa.Float(), nullable=False, server_default="0"))
    op.add_column("transactions", sa.Column("commission_amount", sa.Float(), nullable=False, server_default="0"))
    op.create_foreign_key("fk_transactions_service_provider", "transactions", "users", ["service_provider_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_transactions_service_provider", "transactions", type_="foreignkey")
    op.drop_column("transactions", "commission_amount")
    op.drop_column("transactions", "commission_rate")
    op.drop_column("transactions", "charge_reason")
    op.drop_column("transactions", "additional_charge")
    op.drop_column("transactions", "service_provider_id")
