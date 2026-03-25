"""isolate implementations

Revision ID: a6b7c8d9e0f1
Revises: f3a1b2c3d4e5
Create Date: 2026-03-25 14:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a6b7c8d9e0f1'
down_revision: Union[str, None] = 'f3a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Add new columns as nullable first
    op.add_column('implementations', sa.Column('company_name', sa.String(), nullable=True))
    op.add_column('implementations', sa.Column('zone', sa.String(), nullable=True))
    
    # 2. Drop the foreign key and old column
    op.drop_constraint('implementations_client_id_fkey', 'implementations', type_='foreignkey')
    op.drop_column('implementations', 'client_id')
    
    # 3. Make company_name non-nullable for the future
    # (In a real scenario, we would migrate data here before making it non-nullable)
    op.execute("UPDATE implementations SET company_name = 'Unknown' WHERE company_name IS NULL")
    op.alter_column('implementations', 'company_name', nullable=False)

def downgrade() -> None:
    op.add_column('implementations', sa.Column('client_id', sa.Integer(), nullable=True))
    op.create_foreign_key('implementations_client_id_fkey', 'implementations', 'clients', ['client_id'], ['id'], ondelete='CASCADE')
    op.drop_column('implementations', 'zone')
    op.drop_column('implementations', 'company_name')
