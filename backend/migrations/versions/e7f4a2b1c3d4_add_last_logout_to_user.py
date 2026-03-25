"""add last_logout to user

Revision ID: e7f4a2b1c3d4
Revises: d554e1582b40
Create Date: 2026-03-25 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f4a2b1c3d4'
down_revision: Union[str, None] = 'd554e1582b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('last_logout', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_logout')
