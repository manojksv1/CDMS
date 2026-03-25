"""add hierarchical milestones

Revision ID: b5c6d7e8f9a0
Revises: d4e5f6g7h8i9
Create Date: 2026-03-25 15:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Create milestone_sections table
    op.create_table(
        'milestone_sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=True, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # 2. Add section_id to global_milestones
    op.add_column('global_milestones', sa.Column('section_id', sa.Integer(), nullable=True))
    op.create_foreign_key('global_milestones_section_id_fkey', 'global_milestones', 'milestone_sections', ['section_id'], ['id'], ondelete='CASCADE')
    
    # 3. Add section_name to implementation_tasks
    op.add_column('implementation_tasks', sa.Column('section_name', sa.String(), nullable=True))
    
    # 4. Clean up old section string if it exists from previous manual attempts
    # (Checking if it exists first to avoid errors)
    # op.drop_column('global_milestones', 'section') 

def downgrade() -> None:
    op.drop_column('implementation_tasks', 'section_name')
    op.drop_constraint('global_milestones_section_id_fkey', 'global_milestones', type_='foreignkey')
    op.drop_column('global_milestones', 'section_id')
    op.drop_table('milestone_sections')
