from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
import subprocess
import os
from datetime import datetime
from app.api.deps import get_current_active_admin
from app.core.config import settings

router = APIRouter()

BACKUP_PATH = "/tmp/db_backup.sql"

def run_restore(temp_file: str):
    try:
        db_url = settings.DATABASE_URL
        db_name = db_url.split("/")[-1].split("?")[0]
        
        # 1. Terminate other connections
        kill_cmd = f"psql \"{db_url}\" -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid <> pg_backend_pid();\""
        subprocess.run(kill_cmd, shell=True)
        
        # 2. Drop and Restore
        restore_cmd = f"psql \"{db_url}\" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' && psql \"{db_url}\" -f {temp_file}"
        subprocess.run(restore_cmd, shell=True)
        
        # 3. Upgrade Schema using Alembic to ensure the restored DB is compatible with current code
        print("Running database migrations on restored data...")
        alembic_cmd = "alembic upgrade head"
        subprocess.run(alembic_cmd, shell=True)
        
        print("Background restore and schema upgrade completed.")
    except Exception as e:
        print(f"Background restore failed: {e}")
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

@router.get("/backup")
def backup_database(current_user=Depends(get_current_active_admin)):
    try:
        command = f"pg_dump \"{settings.DATABASE_URL}\" --clean --if-exists -F p -f {BACKUP_PATH}"
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Backup failed: {result.stderr}")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return FileResponse(path=BACKUP_PATH, filename=f"cdms_backup_{timestamp}.sql", media_type='application/sql')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore")
async def restore_database(background_tasks: BackgroundTasks, file: UploadFile = File(...), current_user=Depends(get_current_active_admin)):
    temp_file = "/tmp/restore_db_bg.sql"
    try:
        with open(temp_file, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Run restore in background to avoid disconnecting the API request
        background_tasks.add_task(run_restore, temp_file)
        
        return {"message": "Database restore started in background. The system will be ready in a few seconds."}
    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))
