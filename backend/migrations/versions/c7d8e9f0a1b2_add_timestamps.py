"""add created_at timestamps

Revision ID: c7d8e9f0a1b2
Revises: b5c6d7e8f9a0
Create Date: 2026-03-26 08:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, None] = 'b6c7d8e9f0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('implementations', sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()))
    op.add_column('implementation_tasks', sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()))

def downgrade() -> None:
    op.drop_column('implementation_tasks', 'created_at')
    op.drop_column('implementations', 'created_at')
