"""merge heads

Revision ID: 3f0938e236be
Revises: c659446bebc4, b6c7d8e9f001
Create Date: 2026-07-09 22:56:41.526905

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f0938e236be'
down_revision: Union[str, Sequence[str], None] = ('c659446bebc4', 'b6c7d8e9f001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
