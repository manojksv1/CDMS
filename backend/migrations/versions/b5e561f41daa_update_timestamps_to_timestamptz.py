"""update_timestamps_to_timestamptz

Revision ID: b5e561f41daa
Revises: 80471274c9db
Create Date: 2026-05-10 08:55:24.376008

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b5e561f41daa'
down_revision: Union[str, None] = '80471274c9db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # Use raw SQL for columns that need both a type change AND NOT NULL,
    # because Alembic splits these into two ALTER statements and the
    # SET NOT NULL fails if NULLs exist. Raw SQL handles it atomically.
    # -----------------------------------------------------------------------

    # 1. Backfill NULLs first (safe — no constraint yet)
    op.execute("UPDATE implementation_logs SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE implementation_logs SET date = NOW()::date WHERE date IS NULL")
    op.execute("UPDATE implementation_tasks SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE implementations SET created_at = NOW() WHERE created_at IS NULL")

    # 2. Type-only changes (nullable stays the same — safe for Alembic)
    op.alter_column('activity_logs', 'timestamp',
                    existing_type=postgresql.TIMESTAMP(),
                    type_=sa.DateTime(timezone=True),
                    existing_nullable=False)

    op.alter_column('comments', 'timestamp',
                    existing_type=postgresql.TIMESTAMP(),
                    type_=sa.DateTime(timezone=True),
                    existing_nullable=False)

    op.alter_column('users', 'last_logout',
                    existing_type=postgresql.TIMESTAMP(),
                    type_=sa.DateTime(timezone=True),
                    existing_nullable=True)

    op.alter_column('implementation_tasks', 'completed_at',
                    existing_type=postgresql.TIMESTAMP(),
                    type_=sa.DateTime(timezone=True),
                    existing_nullable=True)

    # 3. Type change + NOT NULL in one raw SQL statement (avoids the split)
    op.execute("""
        ALTER TABLE implementation_logs
            ALTER COLUMN date SET NOT NULL,
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
                USING COALESCE(created_at, NOW()) AT TIME ZONE 'UTC',
            ALTER COLUMN created_at SET NOT NULL
    """)

    op.execute("""
        ALTER TABLE implementation_tasks
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
                USING COALESCE(created_at, NOW()) AT TIME ZONE 'UTC',
            ALTER COLUMN created_at SET NOT NULL
    """)

    op.execute("""
        ALTER TABLE implementations
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
                USING COALESCE(created_at, NOW()) AT TIME ZONE 'UTC',
            ALTER COLUMN created_at SET NOT NULL
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE implementations
            ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
            ALTER COLUMN created_at DROP NOT NULL
    """)

    op.execute("""
        ALTER TABLE implementation_tasks
            ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
            ALTER COLUMN created_at DROP NOT NULL
    """)

    op.execute("""
        ALTER TABLE implementation_logs
            ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
            ALTER COLUMN created_at DROP NOT NULL,
            ALTER COLUMN date DROP NOT NULL
    """)

    op.alter_column('implementation_tasks', 'completed_at',
                    existing_type=sa.DateTime(timezone=True),
                    type_=postgresql.TIMESTAMP(),
                    existing_nullable=True)

    op.alter_column('users', 'last_logout',
                    existing_type=sa.DateTime(timezone=True),
                    type_=postgresql.TIMESTAMP(),
                    existing_nullable=True)

    op.alter_column('comments', 'timestamp',
                    existing_type=sa.DateTime(timezone=True),
                    type_=postgresql.TIMESTAMP(),
                    existing_nullable=False)

    op.alter_column('activity_logs', 'timestamp',
                    existing_type=sa.DateTime(timezone=True),
                    type_=postgresql.TIMESTAMP(),
                    existing_nullable=False)
