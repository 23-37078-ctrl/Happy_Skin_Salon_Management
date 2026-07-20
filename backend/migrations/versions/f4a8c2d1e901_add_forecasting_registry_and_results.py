"""add forecasting registry and results

Revision ID: f4a8c2d1e901
Revises: 580b42cf0f0c
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a8c2d1e901"
down_revision: Union[str, Sequence[str], None] = "580b42cf0f0c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "model_registry",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("algorithm", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=80), nullable=False),
        sa.Column("training_start_date", sa.Date(), nullable=False),
        sa.Column("training_end_date", sa.Date(), nullable=False),
        sa.Column("trained_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("feature_config", sa.JSON(), nullable=False),
        sa.Column("artifact_path", sa.String(length=500), nullable=True),
        sa.Column("artifact_checksum", sa.String(length=64), nullable=True),
        sa.Column("training_rows", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version", name="uq_model_registry_version"),
    )
    op.create_index("ix_model_registry_id", "model_registry", ["id"])
    op.create_index("ix_model_registry_active", "model_registry", ["active"])

    op.create_table(
        "forecast_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=False),
        sa.Column("model_registry_id", sa.Integer(), nullable=False),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("predicted_value", sa.Float(), nullable=False),
        sa.Column("lower_bound", sa.Float(), nullable=True),
        sa.Column("upper_bound", sa.Float(), nullable=True),
        sa.Column("demand_level", sa.String(length=20), nullable=False),
        sa.Column("data_quality", sa.String(length=30), nullable=False),
        sa.Column("generated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("predicted_value >= 0", name="ck_forecast_non_negative"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["model_registry_id"], ["model_registry.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("branch_id", "forecast_date", "model_registry_id", name="uq_forecast_branch_date_model"),
    )
    op.create_index("ix_forecast_results_id", "forecast_results", ["id"])
    op.create_index("ix_forecast_results_branch_id", "forecast_results", ["branch_id"])
    op.create_index("ix_forecast_results_model_registry_id", "forecast_results", ["model_registry_id"])
    op.create_index("ix_forecast_results_forecast_date", "forecast_results", ["forecast_date"])
    op.create_index("ix_forecast_branch_date", "forecast_results", ["branch_id", "forecast_date"])
    op.create_index(
        "ix_bookings_branch_date_status",
        "bookings",
        ["branch_id", "appointment_date", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_bookings_branch_date_status", table_name="bookings")
    op.drop_index("ix_forecast_branch_date", table_name="forecast_results")
    op.drop_index("ix_forecast_results_forecast_date", table_name="forecast_results")
    op.drop_index("ix_forecast_results_model_registry_id", table_name="forecast_results")
    op.drop_index("ix_forecast_results_branch_id", table_name="forecast_results")
    op.drop_index("ix_forecast_results_id", table_name="forecast_results")
    op.drop_table("forecast_results")
    op.drop_index("ix_model_registry_active", table_name="model_registry")
    op.drop_index("ix_model_registry_id", table_name="model_registry")
    op.drop_table("model_registry")
