"""drop old section column

Revision ID: b6c7d8e9f0a1
Revises: b5c6d7e8f9a0
Create Date: 2026-03-25 16:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6c7d8e9f0a1'
down_revision: Union[str, None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Remove the old section string column that is causing NotNullViolation
    op.drop_column('global_milestones', 'section')

def downgrade() -> None:
    op.add_column('global_milestones', sa.Column('section', sa.String(), nullable=True))
