from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.implementation import (
    Implementation, ImplementationCreate, ImplementationUpdate, ImplementationDetail,
    ImplementationLog, ImplementationLogCreate,
    ImplementationTask, ImplementationTaskUpdate
)
from app.services import implementation_service
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[Implementation])
def read_implementations(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return implementation_service.get_implementations(db, current_user, skip=skip, limit=limit)

@router.post("/", response_model=Implementation)
def create_implementation(
    implementation: ImplementationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return implementation_service.create_implementation(db, implementation)

@router.get("/{implementation_id}", response_model=ImplementationDetail)
def read_implementation(
    implementation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_imp = implementation_service.get_implementation(db, implementation_id, current_user)
    if not db_imp:
        raise HTTPException(status_code=404, detail="Implementation not found or access denied")
    
    # Enrichment for frontend
    for log in db_imp.logs:
        if log.user:
            log.user_name = log.user.name
            
    return db_imp

@router.patch("/{implementation_id}", response_model=Implementation)
def update_implementation(
    implementation_id: int,
    implementation_update: ImplementationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_imp = implementation_service.update_implementation(db, implementation_id, implementation_update)
    if not db_imp:
        raise HTTPException(status_code=404, detail="Implementation not found")
    return db_imp

# --- Log Endpoints ---

@router.post("/{implementation_id}/logs", response_model=ImplementationLog)
def create_log(
    implementation_id: int,
    log: ImplementationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_log = implementation_service.create_implementation_log(db, implementation_id, current_user.id, log)
    if not db_log:
        raise HTTPException(status_code=404, detail="Implementation not found")
    return db_log

# --- Task Endpoints ---

@router.patch("/tasks/{task_id}", response_model=ImplementationTask)
def update_task(
    task_id: int,
    task_update: ImplementationTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_task = implementation_service.update_task_status(db, task_id, task_update.is_completed)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task
