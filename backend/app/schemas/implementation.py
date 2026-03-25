from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

# --- Task Schemas ---
class ImplementationTaskBase(BaseModel):
    task_name: str
    section_name: Optional[str] = None
    weight: float
    is_completed: bool = False

class ImplementationTaskCreate(ImplementationTaskBase):
    pass

class ImplementationTaskUpdate(BaseModel):
    is_completed: bool

class ImplementationTask(ImplementationTaskBase):
    id: int
    implementation_id: int
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Log Schemas ---
class ImplementationLogBase(BaseModel):
    date: date
    remarks: str
    percentage_at_time: Optional[float] = None

class ImplementationLogCreate(ImplementationLogBase):
    pass

class ImplementationLog(ImplementationLogBase):
    id: int
    implementation_id: int
    user_id: Optional[int] = None
    created_at: datetime
    user_name: Optional[str] = None 

    class Config:
        from_attributes = True

# --- Implementation Schemas ---
class ImplementationBase(BaseModel):
    company_name: str
    zone: Optional[str] = None
    assigned_user_id: Optional[int] = None
    po_date: Optional[date] = None
    poc_name: Optional[str] = None
    version_details: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: str = "InProgress"

class ImplementationCreate(ImplementationBase):
    pass

class ImplementationUpdate(BaseModel):
    company_name: Optional[str] = None
    zone: Optional[str] = None
    assigned_user_id: Optional[int] = None
    po_date: Optional[date] = None
    poc_name: Optional[str] = None
    version_details: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: Optional[str] = None

class Implementation(ImplementationBase):
    id: int
    current_percentage: float
    assigned_user_name: Optional[str] = None 
    
    class Config:
        from_attributes = True

class ImplementationDetail(Implementation):
    logs: List[ImplementationLog] = []
    tasks: List[ImplementationTask] = []

# --- Section-based Template Schemas ---

class GlobalMilestoneBase(BaseModel):
    task_name: str
    weight: float
    order: int = 0
    section_id: Optional[int] = None

class GlobalMilestoneCreate(GlobalMilestoneBase):
    pass

class GlobalMilestoneUpdate(BaseModel):
    task_name: Optional[str] = None
    weight: Optional[float] = None
    order: Optional[int] = None
    section_id: Optional[int] = None

class GlobalMilestone(GlobalMilestoneBase):
    id: int
    class Config:
        from_attributes = True

class MilestoneSectionBase(BaseModel):
    name: str
    weight: float
    order: int = 0

class MilestoneSectionCreate(MilestoneSectionBase):
    pass

class MilestoneSectionUpdate(BaseModel):
    name: Optional[str] = None
    weight: Optional[float] = None
    order: Optional[int] = None

class MilestoneSection(MilestoneSectionBase):
    id: int
    milestones: List[GlobalMilestone] = []
    
    class Config:
        from_attributes = True
