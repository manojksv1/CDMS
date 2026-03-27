"""add timezone and created_at

Revision ID: a1b2c3d4e5f6
Revises: d8e9f0a1b2c3
Create Date: 2026-03-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add timezone to users with a default value
    op.add_column('users', sa.Column('timezone', sa.String(), server_default='UTC', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'timezone')
