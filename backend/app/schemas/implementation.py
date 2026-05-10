from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Task schemas
# ---------------------------------------------------------------------------

class ImplementationTaskBase(BaseModel):
    task_name: str
    section_name: Optional[str] = None
    weight: float
    is_completed: bool = False
    is_active: Optional[bool] = True


class ImplementationTaskCreate(ImplementationTaskBase):
    pass


class ImplementationTaskUpdate(BaseModel):
    is_completed: bool


class BulkTaskUpdateItem(BaseModel):
    id: int
    is_completed: bool


class BulkTaskUpdate(BaseModel):
    updates: List[BulkTaskUpdateItem]

    @field_validator("updates")
    @classmethod
    def updates_must_not_be_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("updates list must not be empty")
        return v


class ImplementationTask(ImplementationTaskBase):
    id: int
    implementation_id: int
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Log schemas
# ---------------------------------------------------------------------------

class ImplementationLogBase(BaseModel):
    date: date
    remarks: str
    percentage_at_time: Optional[float] = None
    milestone_stage: Optional[str] = None


class ImplementationLogCreate(ImplementationLogBase):
    pass


class ImplementationLog(ImplementationLogBase):
    id: int
    implementation_id: int
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Implementation schemas
# ---------------------------------------------------------------------------

class ImplementationBase(BaseModel):
    company_name: str
    zone: Optional[str] = None
    assigned_user_id: Optional[int] = None
    po_date: Optional[date] = None
    poc_1: Optional[str] = None
    poc_2: Optional[str] = None
    license_uat: Optional[str] = None
    license_prod: Optional[str] = None
    uat_version: Optional[str] = None
    prod_version: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: str = "InProgress"
    status_remarks: Optional[str] = None


class ImplementationCreate(ImplementationBase):
    pass


class ImplementationUpdate(BaseModel):
    company_name: Optional[str] = None
    zone: Optional[str] = None
    assigned_user_id: Optional[int] = None
    po_date: Optional[date] = None
    poc_1: Optional[str] = None
    poc_2: Optional[str] = None
    license_uat: Optional[str] = None
    license_prod: Optional[str] = None
    uat_version: Optional[str] = None
    prod_version: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: Optional[str] = None
    status_remarks: Optional[str] = None


class Implementation(ImplementationBase):
    id: int
    current_percentage: float
    assigned_user_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImplementationDetail(Implementation):
    logs: List[ImplementationLog] = []
    tasks: List[ImplementationTask] = []


# ---------------------------------------------------------------------------
# Milestone / section schemas
# ---------------------------------------------------------------------------

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
