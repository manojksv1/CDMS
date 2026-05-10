import logging
import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File
from fastapi.responses import FileResponse

from app.api.deps import get_current_active_admin
from app.core.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)
router = APIRouter()

BACKUP_PATH = "/tmp/db_backup.sql"
RESTORE_TEMP_PATH = "/tmp/restore_db_bg.sql"


def _parse_db_url(database_url: str) -> dict:
    """Parse DATABASE_URL into components for safe subprocess argument passing."""
    parsed = urlparse(database_url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/"),
    }


def _run_pg_command(args: list[str], env: dict) -> subprocess.CompletedProcess:
    """Run a postgres command with a safe argument list (no shell=True)."""
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )


def _build_pg_env(db_parts: dict) -> dict:
    """Build environment variables for postgres tools (avoids password in args)."""
    env = os.environ.copy()
    env["PGPASSWORD"] = db_parts["password"]
    return env


def _run_restore(temp_file: str) -> None:
    try:
        db_parts = _parse_db_url(settings.DATABASE_URL)
        pg_env = _build_pg_env(db_parts)

        base_args = [
            "-h", db_parts["host"],
            "-p", db_parts["port"],
            "-U", db_parts["user"],
            "-d", db_parts["dbname"],
        ]

        # Terminate other connections
        _run_pg_command(
            ["psql"] + base_args + [
                "-c",
                f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                f"WHERE datname = '{db_parts['dbname']}' AND pid <> pg_backend_pid();",
            ],
            pg_env,
        )

        # Drop and recreate schema
        _run_pg_command(
            ["psql"] + base_args + ["-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"],
            pg_env,
        )

        # Restore from file
        result = _run_pg_command(
            ["psql"] + base_args + ["-f", temp_file],
            pg_env,
        )
        if result.returncode != 0:
            logger.error("Restore failed: %s", result.stderr)
            return

        # Run migrations to ensure schema compatibility
        logger.info("Running alembic upgrade after restore...")
        subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        logger.info("Database restore and migration completed successfully")

    except Exception as exc:
        logger.exception("Background restore failed: %s", exc)
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


@router.get("/backup")
def backup_database(current_user=Depends(get_current_active_admin)):
    try:
        db_parts = _parse_db_url(settings.DATABASE_URL)
        pg_env = _build_pg_env(db_parts)

        result = _run_pg_command(
            [
                "pg_dump",
                "-h", db_parts["host"],
                "-p", db_parts["port"],
                "-U", db_parts["user"],
                "-d", db_parts["dbname"],
                "--clean",
                "--if-exists",
                "-F", "p",
                "-f", BACKUP_PATH,
            ],
            pg_env,
        )

        if result.returncode != 0:
            logger.error("pg_dump failed: %s", result.stderr)
            raise AppError(f"Backup failed: {result.stderr}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        logger.info("Database backup created by user id=%s", current_user.id)
        return FileResponse(
            path=BACKUP_PATH,
            filename=f"cdms_backup_{timestamp}.sql",
            media_type="application/sql",
        )
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Backup endpoint error")
        raise AppError(f"Backup failed: {exc}") from exc


@router.post("/restore")
async def restore_database(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_admin),
):
    try:
        content = await file.read()
        with open(RESTORE_TEMP_PATH, "wb") as buffer:
            buffer.write(content)

        background_tasks.add_task(_run_restore, RESTORE_TEMP_PATH)
        logger.info("Database restore initiated by user id=%s", current_user.id)
        return {
            "message": "Database restore started in background. "
                       "The system will be ready in a few seconds."
        }
    except Exception as exc:
        if os.path.exists(RESTORE_TEMP_PATH):
            os.remove(RESTORE_TEMP_PATH)
        logger.exception("Restore endpoint error")
        raise AppError(f"Restore failed: {exc}") from exc
