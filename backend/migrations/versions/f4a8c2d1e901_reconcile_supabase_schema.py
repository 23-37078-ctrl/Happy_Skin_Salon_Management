"""Reconcile the existing Supabase schema revision.

Revision ID: f4a8c2d1e901
Revises: 580b42cf0f0c
Create Date: 2026-07-21

The deployed Supabase database was already stamped with this revision and
contains the application tables plus its forecasting tables. The original
migration file was not present in the repository. This marker restores the
revision graph without replaying DDL against the live database.
"""

from typing import Sequence, Union


revision: str = "f4a8c2d1e901"
down_revision: Union[str, Sequence[str], None] = "580b42cf0f0c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
