"""add assignment to implementation

Revision ID: b2c3d4e5f6a7
Revises: a6b7c8d9e0f1
Create Date: 2026-03-25 14:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a6b7c8d9e0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('implementations', sa.Column('assigned_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('implementations_assigned_user_id_fkey', 'implementations', 'users', ['assigned_user_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    op.drop_constraint('implementations_assigned_user_id_fkey', 'implementations', type_='foreignkey')
    op.drop_column('implementations', 'assigned_user_id')
