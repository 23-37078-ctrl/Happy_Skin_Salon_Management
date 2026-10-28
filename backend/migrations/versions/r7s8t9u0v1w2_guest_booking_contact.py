"""Allow public guest bookings with contact details."""

from alembic import op
import sqlalchemy as sa


revision = "r7s8t9u0v1w2"
down_revision = "q6r7s8t9u0v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "bookings",
        "customer_id",
        existing_type=sa.Integer(),
        existing_nullable=False,
        nullable=True,
    )
    op.add_column("bookings", sa.Column("guest_name", sa.String(length=100), nullable=True))
    op.add_column("bookings", sa.Column("guest_email", sa.String(length=255), nullable=True))
    op.add_column("bookings", sa.Column("guest_phone", sa.String(length=20), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    guest_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM bookings WHERE customer_id IS NULL")
    ).scalar_one()
    if guest_count:
        raise RuntimeError("Cannot remove guest-booking support while guest bookings still exist.")
    op.drop_column("bookings", "guest_phone")
    op.drop_column("bookings", "guest_email")
    op.drop_column("bookings", "guest_name")
    op.alter_column(
        "bookings",
        "customer_id",
        existing_type=sa.Integer(),
        existing_nullable=True,
        nullable=False,
    )
