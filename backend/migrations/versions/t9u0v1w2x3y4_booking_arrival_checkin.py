"""Track customer arrival for late-arrival handling."""

from alembic import op
import sqlalchemy as sa


revision = "t9u0v1w2x3y4"
down_revision = "s8t9u0v1w2x3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("bookings")}
    if "checked_in_at" not in columns:
        op.add_column("bookings", sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("bookings")}
    if "checked_in_at" in columns:
        op.drop_column("bookings", "checked_in_at")
