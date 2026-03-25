from sqlalchemy.orm import Session
from app.models.implementation import Implementation, ImplementationLog, ImplementationTask, GlobalMilestone, MilestoneSection
from app.models.client import Client
from app.schemas.implementation import (
    ImplementationCreate, 
    ImplementationUpdate, 
    ImplementationLogCreate, 
    ImplementationTaskCreate,
    GlobalMilestoneCreate,
    GlobalMilestoneUpdate,
    MilestoneSectionCreate,
    MilestoneSectionUpdate
)
from datetime import datetime
from app.models.user import User, UserRole

# --- Implementation Services ---

def get_implementations(db: Session, current_user: User, skip: int = 0, limit: int = 100):
    query = db.query(Implementation)
    if current_user.role == UserRole.ENGINEER:
        query = query.filter(Implementation.assigned_user_id == current_user.id)
    imps = query.offset(skip).limit(limit).all()
    for imp in imps:
        if imp.assigned_user:
            imp.assigned_user_name = imp.assigned_user.name
    return imps

def get_implementation(db: Session, implementation_id: int, current_user: User):
    query = db.query(Implementation).filter(Implementation.id == implementation_id)
    if current_user.role == UserRole.ENGINEER:
        query = query.filter(Implementation.assigned_user_id == current_user.id)
    imp = query.first()
    if imp and imp.assigned_user:
        imp.assigned_user_name = imp.assigned_user.name
    return imp

def create_implementation(db: Session, implementation: ImplementationCreate):
    db_imp = Implementation(**implementation.model_dump())
    db.add(db_imp)
    db.commit()
    db.refresh(db_imp)
    
    # NEW: Fetch sections and their milestones
    sections = db.query(MilestoneSection).order_by(MilestoneSection.order).all()
    
    if not sections:
        seed_default_milestones(db)
        sections = db.query(MilestoneSection).order_by(MilestoneSection.order).all()

    for section in sections:
        for m in section.milestones:
            db_task = ImplementationTask(
                implementation_id=db_imp.id, 
                task_name=m.task_name, 
                section_name=section.name,
                weight=m.weight
            )
            db.add(db_task)
    
    db.commit()
    db.refresh(db_imp)
    return db_imp

def sync_implementation_milestones(db: Session, implementation_id: int):
    # Fetch all global milestones via sections
    master_milestones = db.query(GlobalMilestone).all()
    
    current = db.query(ImplementationTask).filter(ImplementationTask.implementation_id == implementation_id).all()
    current_names = {t.task_name for t in current}
    
    added = 0
    for m in master_milestones:
        if m.task_name not in current_names:
            db_task = ImplementationTask(
                implementation_id=implementation_id,
                task_name=m.task_name,
                section_name=m.section.name if m.section else "General",
                weight=m.weight
            )
            db.add(db_task)
            added += 1
            
    db.commit()
    recalculate_percentage(db, implementation_id)
    return added

def update_implementation(db: Session, implementation_id: int, implementation_update: ImplementationUpdate):
    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if not db_imp: return None
    for key, value in implementation_update.model_dump(exclude_unset=True).items():
        setattr(db_imp, key, value)
    db.commit()
    db.refresh(db_imp)
    return db_imp

# --- Task Services ---

def update_task_status(db: Session, task_id: int, is_completed: bool):
    db_task = db.query(ImplementationTask).filter(ImplementationTask.id == task_id).first()
    if not db_task: return None
    db_task.is_completed = is_completed
    db_task.completed_at = datetime.utcnow() if is_completed else None
    db.commit()
    recalculate_percentage(db, db_task.implementation_id)
    return db_task

def recalculate_percentage(db: Session, implementation_id: int):
    tasks = db.query(ImplementationTask).filter(ImplementationTask.implementation_id == implementation_id).all()
    total_percentage = sum(t.weight for t in tasks if t.is_completed)
    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if db_imp:
        db_imp.current_percentage = round(total_percentage, 2)
        db.commit()

# --- Log Services ---

def create_implementation_log(db: Session, implementation_id: int, user_id: int, log: ImplementationLogCreate):
    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if not db_imp: return None
    db_log = ImplementationLog(
        implementation_id=implementation_id, user_id=user_id, date=log.date, remarks=log.remarks, percentage_at_time=db_imp.current_percentage
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

# --- Section & Template Services ---

def get_milestone_sections(db: Session):
    return db.query(MilestoneSection).order_by(MilestoneSection.order).all()

def create_milestone_section(db: Session, section: MilestoneSectionCreate):
    db_s = MilestoneSection(**section.model_dump())
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    return db_s

def update_milestone_section(db: Session, section_id: int, update: MilestoneSectionUpdate):
    db_s = db.query(MilestoneSection).filter(MilestoneSection.id == section_id).first()
    if not db_s: return None
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(db_s, key, value)
    db.commit()
    db.refresh(db_s)
    return db_s

def delete_milestone_section(db: Session, section_id: int):
    db_s = db.query(MilestoneSection).filter(MilestoneSection.id == section_id).first()
    if db_s:
        db.delete(db_s)
        db.commit()
    return db_s

def get_global_milestones(db: Session):
    return db.query(GlobalMilestone).order_by(GlobalMilestone.order).all()

def create_global_milestone(db: Session, milestone: GlobalMilestoneCreate):
    db_m = GlobalMilestone(**milestone.model_dump())
    db.add(db_m)
    db.commit()
    db.refresh(db_m)
    return db_m

def update_global_milestone(db: Session, milestone_id: int, update: GlobalMilestoneUpdate):
    db_m = db.query(GlobalMilestone).filter(GlobalMilestone.id == milestone_id).first()
    if not db_m: return None
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(db_m, key, value)
    db.commit()
    db.refresh(db_m)
    return db_m

def delete_global_milestone(db: Session, milestone_id: int):
    db_m = db.query(GlobalMilestone).filter(GlobalMilestone.id == milestone_id).first()
    if db_m:
        db.delete(db_m)
        db.commit()
    return db_m

def bulk_reorder_milestones(db: Session, milestone_ids: list[int]):
    for index, m_id in enumerate(milestone_ids):
        db.query(GlobalMilestone).filter(GlobalMilestone.id == m_id).update({"order": index})
    db.commit()
    return True

def seed_default_milestones(db: Session):
    # This seeds your EXACT requested structure with sections
    structure = [
        ("Pre_Requisites for DMS Implementation", 20.0, [
            ("Initial Pre-requisites Check", 20.0)
        ]),
        ("Preparation of DMS implementation plan", 10.0, [
            ("Creation of Implementation Plan", 10.0)
        ]),
        ("Contentverse Installation and Configuration", 40.0, [
            ("MSI installation", 2.0),
            ("Creation of Room Structures", 5.0),
            ("Creation of Document Types", 3.0),
            ("Index Fields with required Masking", 2.0),
            ("Advanced search and FTS", 3.0),
            ("Security Rights", 2.0),
            ("SMTP Email Notifications", 5.0),
            ("Workflow", 8.0),
            ("AD/LDAP", 5.0),
            ("SSL Certification", 5.0),
        ]),
        ("Testing and test reports", 10.0, [
            ("Testing execution & test reports", 5.0),
            ("Result & SOP documentation", 5.0),
        ]),
        ("Training", 10.0, [
            ("Introduction to Contentverse", 1.0),
            ("Room Structure Training", 1.0),
            ("Permissions & branched users", 1.0),
            ("Uploading & Annotations", 1.0),
            ("Version control & Comments", 1.0),
            ("Checkout/Checkin Mini ViewWise", 1.0),
            ("Export through Email", 1.0),
            ("Advance & Full Text Search", 1.0),
            ("Input Tray & Retention", 1.0),
            ("Workflow Training", 1.0),
        ]),
        ("Administator Training", 10.0, [
            ("Admin Dashboard & Storage", 2.0),
            ("Audit Trail & Users/Groups", 2.0),
            ("Template & Backup/Restore", 2.0),
            ("Redactions & Document Locking", 2.0),
            ("Admin Workflow & Reports", 2.0),
        ]),
        ("Customer sign off Document", 10.0, [
            ("Final Customer sign off Document", 10.0)
        ])
    ]
    
    # Note: I adjusted some weights slightly to ensure they sum to the requested totals
    
    for idx, (sec_name, sec_weight, tasks) in enumerate(structure):
        db_sec = MilestoneSection(name=sec_name, weight=sec_weight, order=idx)
        db.add(db_sec)
        db.commit()
        db.refresh(db_sec)
        
        for t_idx, (t_name, t_weight) in enumerate(tasks):
            db_m = GlobalMilestone(
                task_name=t_name, 
                section_id=db_sec.id, 
                weight=t_weight, 
                order=t_idx
            )
            db.add(db_m)
        db.commit()
