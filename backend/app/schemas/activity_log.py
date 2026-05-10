from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ActivityLogBase(BaseModel):
    task_id: int
    old_status: str
    new_status: str

class ActivityLogCreate(ActivityLogBase):
    changed_by: Optional[int] = None

class ActivityLogResponse(ActivityLogBase):
    id: int
    changed_by: Optional[int] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True
