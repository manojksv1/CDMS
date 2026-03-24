from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.task import Task, TaskStatus
from app.models.activity_log import ActivityLog
from app.schemas.task import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskAssign
from app.models.user import User, UserRole
from datetime import datetime

def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Task).offset(skip).limit(limit).all()

def get_tasks_by_location(db: Session, location_id: int):
    return db.query(Task).filter(Task.location_id == location_id).all()

def get_task(db: Session, task_id: int):
    return db.query(Task).filter(Task.id == task_id).first()

def create_task(db: Session, task: TaskCreate):
    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def assign_task(db: Session, task_id: int, task_assign: TaskAssign, current_user: User):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Managers and Admins can assign tasks.")
    
    db_task = get_task(db, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db_task.assigned_to = task_assign.assigned_to
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task_status(db: Session, task_id: int, status_update: TaskStatusUpdate, current_user: User):
    db_task = get_task(db, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Permission check: if Engineer, must be assigned to this task
    if current_user.role == UserRole.ENGINEER:
        if db_task.assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="Engineers can only update tasks assigned to them.")

    old_status = db_task.status
    new_status = status_update.status

    if old_status == new_status:
        return db_task

    # Business Logic: Workflow constraints
    if new_status == TaskStatus.IN_PROGRESS:
        if db_task.dependency_task_id:
            dep_task = get_task(db, db_task.dependency_task_id)
            if dep_task and dep_task.status != TaskStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Cannot start task until dependency is COMPLETED.")
    
    if new_status == TaskStatus.COMPLETED and old_status != TaskStatus.IN_PROGRESS:
        # A task usually has to be in progress to be completed, but let's allow it from BLOCKED if it was previously in progress?
        # Requirement: "Only IN_PROGRESS tasks can be COMPLETED"
        raise HTTPException(status_code=400, detail="Only IN_PROGRESS tasks can be COMPLETED.")

    db_task.status = new_status
    db.commit()
    db.refresh(db_task)

    # Log Activity
    activity_log = ActivityLog(
        task_id=db_task.id,
        changed_by=current_user.id,
        old_status=old_status.value,
        new_status=new_status.value,
        timestamp=datetime.utcnow()
    )
    db.add(activity_log)
    db.commit()

    return db_task

def get_task_activity_logs(db: Session, task_id: int):
    return db.query(ActivityLog).filter(ActivityLog.task_id == task_id).order_by(ActivityLog.timestamp.desc()).all()
