"""Merge the GCash verification and no-show migration heads."""

from typing import Sequence, Union


revision: str = "3a9f1c7d2b4e"
down_revision: Union[str, Sequence[str], None] = (
    "a1c2e3f4g5h6",
    "c3d4e5f6a7b8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Join both migration branches; each branch contains its own changes."""


def downgrade() -> None:
    """No schema changes are made by this merge revision."""
