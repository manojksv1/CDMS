import logging
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User, UserRole
from app.core.exceptions import ForbiddenError, NotFoundError
from app.schemas.implementation import (
    BulkTaskUpdate,
    GlobalMilestone,
    GlobalMilestoneCreate,
    GlobalMilestoneUpdate,
    Implementation,
    ImplementationCreate,
    ImplementationDetail,
    ImplementationLog,
    ImplementationLogCreate,
    ImplementationTask,
    ImplementationTaskUpdate,
    ImplementationUpdate,
    MilestoneSection,
    MilestoneSectionCreate,
    MilestoneSectionUpdate,
)
from app.services import implementation_service

logger = logging.getLogger(__name__)
router = APIRouter()

_TEMPLATE_ROLES = (UserRole.ADMIN, UserRole.MANAGER)


def _require_template_access(current_user: User) -> None:
    if current_user.role not in _TEMPLATE_ROLES:
        raise ForbiddenError("Only Admins and Managers can manage milestone templates")


# ---------------------------------------------------------------------------
# Implementation endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[Implementation])
def read_implementations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.get_implementations(db, current_user, skip=skip, limit=limit)


@router.post("/", response_model=Implementation, status_code=201)
def create_implementation(
    implementation: ImplementationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.create_implementation(db, implementation)


@router.get("/{implementation_id}", response_model=ImplementationDetail)
def read_implementation(
    implementation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_imp = implementation_service.get_implementation(db, implementation_id, current_user)

    # Backfill missing section names for legacy data
    modified = False
    for task in db_imp.tasks:
        if not task.section_name:
            task.section_name = "General"
            modified = True
    if modified:
        db.commit()

    # Enrich logs with user names
    for log in db_imp.logs:
        if log.user:
            log.user_name = log.user.name

    return db_imp


@router.patch("/{implementation_id}", response_model=Implementation)
def update_implementation(
    implementation_id: int,
    implementation_update: ImplementationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.update_implementation(db, implementation_id, implementation_update)


# ---------------------------------------------------------------------------
# Log endpoints
# ---------------------------------------------------------------------------

@router.post("/{implementation_id}/logs", response_model=ImplementationLog, status_code=201)
def create_log(
    implementation_id: int,
    log: ImplementationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.create_implementation_log(
        db, implementation_id, current_user.id, log
    )


# ---------------------------------------------------------------------------
# Task endpoints
# ---------------------------------------------------------------------------

@router.patch("/tasks/{task_id}", response_model=ImplementationTask)
def update_task(
    task_id: int,
    task_update: ImplementationTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.update_task_status(db, task_id, task_update.is_completed)


@router.patch("/tasks-bulk/update")
def bulk_update_tasks(
    payload: BulkTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = [item.model_dump() for item in payload.updates]
    implementation_service.bulk_update_tasks(db, updates)
    return {"message": f"{len(updates)} tasks updated successfully"}


# ---------------------------------------------------------------------------
# Section endpoints
# ---------------------------------------------------------------------------

@router.get("/sections/", response_model=List[MilestoneSection])
def read_sections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.get_milestone_sections(db)


@router.post("/sections/", response_model=MilestoneSection, status_code=201)
def create_section(
    section: MilestoneSectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    return implementation_service.create_milestone_section(db, section)


@router.patch("/sections/{section_id}", response_model=MilestoneSection)
def update_section(
    section_id: int,
    update: MilestoneSectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    return implementation_service.update_milestone_section(db, section_id, update)


@router.delete("/sections/{section_id}", status_code=204)
def delete_section(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    implementation_service.delete_milestone_section(db, section_id)


# ---------------------------------------------------------------------------
# Template (GlobalMilestone) endpoints
# ---------------------------------------------------------------------------

@router.get("/templates/", response_model=List[GlobalMilestone])
def read_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return implementation_service.get_global_milestones(db)


@router.post("/templates/", response_model=GlobalMilestone, status_code=201)
def create_template(
    milestone: GlobalMilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    return implementation_service.create_global_milestone(db, milestone)


@router.patch("/templates/{milestone_id}", response_model=GlobalMilestone)
def update_template(
    milestone_id: int,
    milestone_update: GlobalMilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    return implementation_service.update_global_milestone(db, milestone_id, milestone_update)


@router.delete("/templates/{milestone_id}", status_code=204)
def delete_template(
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    implementation_service.delete_global_milestone(db, milestone_id)


@router.post("/templates/bulk-reorder")
def bulk_reorder_templates(
    milestone_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_template_access(current_user)
    implementation_service.bulk_reorder_milestones(db, milestone_ids)
    return {"message": "Bulk reorder successful"}


@router.post("/{implementation_id}/sync-template")
def sync_project_template(
    implementation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    added, updated, removed = implementation_service.sync_implementation_milestones(
        db, implementation_id
    )
    return {
        "message": (
            f"Synced successfully. "
            f"Added {added} new, updated {updated} weights, removed {removed} old milestones."
        )
    }
