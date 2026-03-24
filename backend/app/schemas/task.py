from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.models.task import TaskStatus

class TaskBase(BaseModel):
    name: str
    due_date: date
    build_version: Optional[str] = None
    remarks: Optional[str] = None
    dependency_task_id: Optional[int] = None

class TaskCreate(TaskBase):
    location_id: int

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    due_date: Optional[date] = None
    build_version: Optional[str] = None
    remarks: Optional[str] = None
    dependency_task_id: Optional[int] = None

class TaskStatusUpdate(BaseModel):
    status: TaskStatus

class TaskAssign(BaseModel):
    assigned_to: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    location_id: int
    status: TaskStatus
    assigned_to: Optional[int] = None

    class Config:
        from_attributes = True
