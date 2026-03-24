from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskStatusUpdate, TaskAssign
from app.schemas.activity_log import ActivityLogResponse
from app.services import task_service
from app.api.deps import get_current_user, get_current_active_admin, get_current_manager_or_admin
from app.models.user import User, UserRole

router = APIRouter()

@router.post("/", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_manager_or_admin)):
    return task_service.create_task(db=db, task=task)

@router.get("/", response_model=List[TaskResponse])
def read_tasks(location_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if location_id:
        return task_service.get_tasks_by_location(db, location_id=location_id)
    if current_user.role == UserRole.ENGINEER:
        return task_service.get_tasks_by_user(db, current_user.id)
    return task_service.get_tasks(db, skip=skip, limit=limit)

@router.get("/{task_id}", response_model=TaskResponse)
def read_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_task = task_service.get_task(db, task_id=task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return task_service.update_task(db=db, task_id=task_id, task_update=task_update, current_user=current_user)

@router.patch("/{task_id}/assign", response_model=TaskResponse)
def assign_task(task_id: int, task_assign: TaskAssign, db: Session = Depends(get_db), current_user: User = Depends(get_current_manager_or_admin)):
    return task_service.assign_task(db=db, task_id=task_id, task_assign=task_assign, current_user=current_user)

@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(task_id: int, status_update: TaskStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return task_service.update_task_status(db=db, task_id=task_id, status_update=status_update, current_user=current_user)

@router.get("/{task_id}/logs", response_model=List[ActivityLogResponse])
def read_task_logs(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return task_service.get_task_activity_logs(db=db, task_id=task_id)
