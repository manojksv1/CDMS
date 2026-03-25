"""add implementation tracker tables

Revision ID: f3a1b2c3d4e5
Revises: e7f4a2b1c3d4
Create Date: 2026-03-25 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3a1b2c3d4e5'
down_revision: Union[str, None] = 'e7f4a2b1c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Create implementations table
    op.create_table(
        'implementations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('po_date', sa.Date(), nullable=True),
        sa.Column('poc_name', sa.String(), nullable=True),
        sa.Column('version_details', sa.String(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('expected_end_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(), nullable=True, server_default='InProgress'),
        sa.Column('current_percentage', sa.Float(), nullable=True, server_default='0.0'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_implementations_id'), 'implementations', ['id'], unique=False)

    # Create implementation_logs table
    op.create_table(
        'implementation_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('implementation_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('date', sa.Date(), nullable=True),
        sa.Column('remarks', sa.String(), nullable=False),
        sa.Column('percentage_at_time', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['implementation_id'], ['implementations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_implementation_logs_id'), 'implementation_logs', ['id'], unique=False)

    # Create implementation_tasks table
    op.create_table(
        'implementation_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('implementation_id', sa.Integer(), nullable=False),
        sa.Column('task_name', sa.String(), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['implementation_id'], ['implementations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_implementation_tasks_id'), 'implementation_tasks', ['id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_implementation_tasks_id'), table_name='implementation_tasks')
    op.drop_table('implementation_tasks')
    op.drop_index(op.f('ix_implementation_logs_id'), table_name='implementation_logs')
    op.drop_table('implementation_logs')
    op.drop_index(op.f('ix_implementations_id'), table_name='implementations')
    op.drop_table('implementations')
