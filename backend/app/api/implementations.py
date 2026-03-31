from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.implementation import (
    Implementation, ImplementationCreate, ImplementationUpdate, ImplementationDetail,
    ImplementationLog, ImplementationLogCreate,
    ImplementationTask, ImplementationTaskUpdate,
    GlobalMilestone, GlobalMilestoneCreate, GlobalMilestoneUpdate,
    MilestoneSection, MilestoneSectionCreate, MilestoneSectionUpdate
)
from app.services import implementation_service
from app.models.user import User, UserRole

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
    
    # Simple migration logic for old data
    modified = False
    for task in db_imp.tasks:
        if not task.section_name:
            task.section_name = "General"
            modified = True
    if modified: db.commit()

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

@router.patch("/tasks-bulk/update")
def bulk_update_tasks(
    updates: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = implementation_service.bulk_update_tasks(db, updates)
    return {"message": "Tasks updated successfully"}
# --- Section & Template Endpoints ---

@router.get("/sections/", response_model=List[MilestoneSection])
def read_sections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return implementation_service.get_milestone_sections(db)

@router.post("/sections/", response_model=MilestoneSection)
def create_section(
    section: MilestoneSectionCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return implementation_service.create_milestone_section(db, section)

@router.patch("/sections/{section_id}", response_model=MilestoneSection)
def update_section(
    section_id: int,
    update: MilestoneSectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return implementation_service.update_milestone_section(db, section_id, update)

@router.delete("/sections/{section_id}")
def delete_section(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    implementation_service.delete_milestone_section(db, section_id)
    return {"message": "Section deleted"}

@router.get("/templates/", response_model=List[GlobalMilestone])
def read_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return implementation_service.get_global_milestones(db)

@router.post("/templates/", response_model=GlobalMilestone)
def create_template(
    milestone: GlobalMilestoneCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admins/Managers can edit templates")
    return implementation_service.create_global_milestone(db, milestone)

@router.patch("/templates/{milestone_id}", response_model=GlobalMilestone)
def update_template(
    milestone_id: int,
    milestone_update: GlobalMilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admins/Managers can edit templates")
    db_m = implementation_service.update_global_milestone(db, milestone_id, milestone_update)
    if not db_m: raise HTTPException(status_code=404, detail="Template item not found")
    return db_m

@router.delete("/templates/{milestone_id}")
def delete_template(
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admins/Managers can edit templates")
    implementation_service.delete_global_milestone(db, milestone_id)
    return {"message": "Template item deleted"}

@router.post("/templates/bulk-reorder")
def bulk_reorder_templates(
    milestone_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admins/Managers can edit templates")
    implementation_service.bulk_reorder_milestones(db, milestone_ids)
    return {"message": "Bulk reorder successful"}

@router.post("/{implementation_id}/sync-template")
def sync_project_template(
    implementation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    added, updated = implementation_service.sync_implementation_milestones(db, implementation_id)
    return {"message": f"Synced successfully. Added {added} new milestones and updated {updated} existing weights."}
