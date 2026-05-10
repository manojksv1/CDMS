import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, ForbiddenError, NotFoundError
from app.models.activity_log import ActivityLog
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.task import TaskAssign, TaskCreate, TaskStatusUpdate, TaskUpdate

logger = logging.getLogger(__name__)


def get_tasks(db: Session, skip: int = 0, limit: int = 100) -> list[Task]:
    return db.query(Task).offset(skip).limit(limit).all()


def get_tasks_by_user(db: Session, user_id: int) -> list[Task]:
    return db.query(Task).filter(Task.assigned_to == user_id).all()


def get_tasks_by_location(db: Session, location_id: int) -> list[Task]:
    return db.query(Task).filter(Task.location_id == location_id).all()


def get_task(db: Session, task_id: int) -> Task | None:
    return db.query(Task).filter(Task.id == task_id).first()


def _require_task(db: Session, task_id: int) -> Task:
    task = get_task(db, task_id)
    if not task:
        raise NotFoundError(f"Task id={task_id} not found")
    return task


def create_task(db: Session, task: TaskCreate) -> Task:
    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    logger.info("Created task id=%s name=%s", db_task.id, db_task.name)
    return db_task


def assign_task(db: Session, task_id: int, task_assign: TaskAssign, current_user: User) -> Task:
    db_task = _require_task(db, task_id)
    db_task.assigned_to = task_assign.assigned_to
    db.commit()
    db.refresh(db_task)
    logger.info("Task id=%s assigned to user_id=%s", task_id, task_assign.assigned_to)
    return db_task


def update_task_status(
    db: Session, task_id: int, status_update: TaskStatusUpdate, current_user: User
) -> Task:
    db_task = _require_task(db, task_id)

    if current_user.role == UserRole.ENGINEER and db_task.assigned_to != current_user.id:
        raise ForbiddenError("Engineers can only update tasks assigned to them")

    old_status = db_task.status
    new_status = status_update.status

    if old_status == new_status:
        return db_task

    if new_status == TaskStatus.IN_PROGRESS and db_task.dependency_task_id:
        dep = get_task(db, db_task.dependency_task_id)
        if dep and dep.status != TaskStatus.COMPLETED:
            raise BusinessRuleError("Cannot start task until its dependency is COMPLETED")

    db_task.status = new_status
    db.commit()
    db.refresh(db_task)

    db.add(
        ActivityLog(
            task_id=db_task.id,
            changed_by=current_user.id,
            old_status=old_status.value,
            new_status=new_status.value,
            timestamp=datetime.now(timezone.utc),
        )
    )
    db.commit()

    logger.info(
        "Task id=%s status changed %s -> %s by user id=%s",
        task_id, old_status.value, new_status.value, current_user.id,
    )
    return db_task


def update_task(
    db: Session, task_id: int, task_update: TaskUpdate, current_user: User
) -> Task:
    db_task = _require_task(db, task_id)

    if current_user.role == UserRole.ENGINEER and db_task.assigned_to != current_user.id:
        raise ForbiddenError("Engineers can only update tasks assigned to them")

    for key, value in task_update.model_dump(exclude_unset=True).items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


def get_task_activity_logs(db: Session, task_id: int) -> list[ActivityLog]:
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.task_id == task_id)
        .order_by(ActivityLog.timestamp.desc())
        .all()
    )
