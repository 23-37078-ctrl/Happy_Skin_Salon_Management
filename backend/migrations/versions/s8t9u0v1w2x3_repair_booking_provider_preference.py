"""Repair booking provider preference schema drift."""

from alembic import op
import sqlalchemy as sa


revision = "s8t9u0v1w2x3"
down_revision = "r7s8t9u0v1w2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("bookings")}
    if "preferred_service_provider_id" not in columns:
        op.add_column(
            "bookings",
            sa.Column("preferred_service_provider_id", sa.Integer(), nullable=True),
        )

    inspector = sa.inspect(op.get_bind())
    foreign_keys = inspector.get_foreign_keys("bookings")
    if not any(
        foreign_key.get("constrained_columns") == ["preferred_service_provider_id"]
        for foreign_key in foreign_keys
    ):
        op.create_foreign_key(
            "fk_bookings_preferred_service_provider",
            "bookings",
            "users",
            ["preferred_service_provider_id"],
            ["id"],
            ondelete="SET NULL",
        )

    inspector = sa.inspect(op.get_bind())
    indexes = inspector.get_indexes("bookings")
    if not any(index.get("column_names") == ["preferred_service_provider_id"] for index in indexes):
        op.create_index(
            "ix_bookings_preferred_service_provider_id",
            "bookings",
            ["preferred_service_provider_id"],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("bookings")}
    if "preferred_service_provider_id" not in columns:
        return

    indexes = inspector.get_indexes("bookings")
    if any(index.get("column_names") == ["preferred_service_provider_id"] for index in indexes):
        op.drop_index("ix_bookings_preferred_service_provider_id", table_name="bookings")

    foreign_keys = inspector.get_foreign_keys("bookings")
    constraint = next(
        (
            foreign_key["name"]
            for foreign_key in foreign_keys
            if foreign_key.get("constrained_columns") == ["preferred_service_provider_id"]
        ),
        None,
    )
    if constraint:
        op.drop_constraint(constraint, "bookings", type_="foreignkey")

    op.drop_column("bookings", "preferred_service_provider_id")
