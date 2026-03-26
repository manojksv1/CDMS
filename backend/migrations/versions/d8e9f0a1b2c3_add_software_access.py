"""add software_access

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-03-26 09:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    softwareaccess = postgresql.ENUM('INSTALLATION', 'IMPLEMENTATION', 'BOTH', name='softwareaccess')
    softwareaccess.create(op.get_bind(), checkfirst=True)
    op.add_column('users', sa.Column('software_access', softwareaccess, nullable=False, server_default='BOTH'))

def downgrade() -> None:
    op.drop_column('users', 'software_access')
    softwareaccess = postgresql.ENUM('INSTALLATION', 'IMPLEMENTATION', 'BOTH', name='softwareaccess')
    softwareaccess.drop(op.get_bind(), checkfirst=True)
