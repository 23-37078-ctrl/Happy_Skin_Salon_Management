"""add branch_id to users

Revision ID: 848c048cfae4
Revises: 2e684c92476a
Create Date: 2026-06-21 00:09:53.590854

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '848c048cfae4'
down_revision: Union[str, Sequence[str], None] = '2e684c92476a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('branch_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_users_branch_id_branches', 'users', 'branches', ['branch_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_users_branch_id_branches', 'users', type_='foreignkey')
    op.drop_column('users', 'branch_id')