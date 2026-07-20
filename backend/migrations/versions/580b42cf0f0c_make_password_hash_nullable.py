"""make password_hash nullable

Revision ID: 580b42cf0f0c
Revises: 045e2604f0ae
Create Date: 2026-07-14 16:02:46.804381

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '580b42cf0f0c'
down_revision: Union[str, Sequence[str], None] = '045e2604f0ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.alter_column('users', 'password_hash',
        existing_type=sa.String(255),
        nullable=True)

def downgrade():
    op.alter_column('users', 'password_hash',
        existing_type=sa.String(255),
        nullable=False)
