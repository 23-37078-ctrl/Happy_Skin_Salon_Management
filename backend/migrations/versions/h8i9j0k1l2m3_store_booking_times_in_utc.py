"""Store appointment times as timezone-aware UTC values.

Revision ID: h8i9j0k1l2m3
Revises: g7d5e2c9a316
"""

import sqlalchemy as sa
from alembic import op


revision = "h8i9j0k1l2m3"
down_revision = "g7d5e2c9a316"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        op.alter_column(
            "bookings",
            "appointment_date",
            existing_type=sa.DateTime(),
            type_=sa.DateTime(timezone=True),
        )
        return

    column_type = connection.execute(
        sa.text(
            """
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'bookings'
              AND column_name = 'appointment_date'
            """
        )
    ).scalar_one()

    if column_type == "timestamp without time zone":
        op.alter_column(
            "bookings",
            "appointment_date",
            existing_type=sa.DateTime(),
            type_=sa.DateTime(timezone=True),
            postgresql_using="appointment_date AT TIME ZONE 'Asia/Manila'",
        )
    else:
        connection.execute(
            sa.text(
                "UPDATE bookings "
                "SET appointment_date = appointment_date - INTERVAL '8 hours'"
            )
        )


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.alter_column(
            "bookings",
            "appointment_date",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(),
            postgresql_using="appointment_date AT TIME ZONE 'Asia/Manila'",
        )
    else:
        op.alter_column(
            "bookings",
            "appointment_date",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(),
        )
