from sqlalchemy.orm import Session
from app.models.implementation import Implementation, ImplementationLog, ImplementationTask, GlobalMilestone
from app.models.client import Client
from app.schemas.implementation import (
    ImplementationCreate, 
    ImplementationUpdate, 
    ImplementationLogCreate, 
    ImplementationTaskCreate,
    GlobalMilestoneCreate,
    GlobalMilestoneUpdate
)
from datetime import datetime
from app.models.user import User, UserRole

# --- Implementation Services ---

def get_implementations(db: Session, current_user: User, skip: int = 0, limit: int = 100):
    query = db.query(Implementation)
    
    # Permission Gate: Engineers only see their assigned projects
    if current_user.role == UserRole.ENGINEER:
        query = query.filter(Implementation.assigned_user_id == current_user.id)
        
    imps = query.offset(skip).limit(limit).all()
    
    # Enrichment
    for imp in imps:
        if imp.assigned_user:
            imp.assigned_user_name = imp.assigned_user.name
            
    return imps

def get_implementation(db: Session, implementation_id: int, current_user: User):
    query = db.query(Implementation).filter(Implementation.id == implementation_id)
    
    # Permission Gate
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
    
    # NEW: Fetch tasks from the Master Template table
    master_milestones = db.query(GlobalMilestone).order_by(GlobalMilestone.order).all()
    
    # If template is empty, seed it first (Initial run fallback)
    if not master_milestones:
        seed_default_milestones(db)
        master_milestones = db.query(GlobalMilestone).order_by(GlobalMilestone.order).all()

    for m in master_milestones:
        db_task = ImplementationTask(
            implementation_id=db_imp.id, 
            task_name=m.task_name, 
            section=m.section,
            weight=m.weight
        )
        db.add(db_task)
    
    db.commit()
    db.refresh(db_imp)
    return db_imp

def sync_implementation_milestones(db: Session, implementation_id: int):
    # Fetch master template
    master = db.query(GlobalMilestone).all()
    
    # Fetch current project milestones
    current = db.query(ImplementationTask).filter(ImplementationTask.implementation_id == implementation_id).all()
    current_names = {t.task_name for t in current}
    
    # Add missing ones
    added = 0
    for m in master:
        if m.task_name not in current_names:
            db_task = ImplementationTask(
                implementation_id=implementation_id,
                task_name=m.task_name,
                section=m.section,
                weight=m.weight
            )
            db.add(db_task)
            added += 1
            
    db.commit()
    recalculate_percentage(db, implementation_id)
    return added

def update_implementation(db: Session, implementation_id: int, implementation_update: ImplementationUpdate):
    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if not db_imp:
        return None
    
    update_data = implementation_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_imp, key, value)
    
    db.commit()
    db.refresh(db_imp)
    return db_imp

# --- Task Services ---

def update_task_status(db: Session, task_id: int, is_completed: bool):
    db_task = db.query(ImplementationTask).filter(ImplementationTask.id == task_id).first()
    if not db_task:
        return None
    
    db_task.is_completed = is_completed
    db_task.completed_at = datetime.utcnow() if is_completed else None
    db.commit()
    
    # Recalculate total percentage for the implementation
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
    if not db_imp:
        return None
        
    db_log = ImplementationLog(
        implementation_id=implementation_id,
        user_id=user_id,
        date=log.date,
        remarks=log.remarks,
        percentage_at_time=db_imp.current_percentage
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

# --- Template Management Services ---

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

def reorder_global_milestone(db: Session, milestone_id: int, direction: str):
    db_m = db.query(GlobalMilestone).filter(GlobalMilestone.id == milestone_id).first()
    if not db_m: return None
    
    # Simple swap logic
    if direction == "up":
        target = db.query(GlobalMilestone).filter(GlobalMilestone.order < db_m.order).order_by(GlobalMilestone.order.desc()).first()
    else:
        target = db.query(GlobalMilestone).filter(GlobalMilestone.order > db_m.order).order_by(GlobalMilestone.order.asc()).first()
        
    if target:
        # Swap orders
        db_m.order, target.order = target.order, db_m.order
        db.commit()
        
    return db_m

def bulk_reorder_milestones(db: Session, milestone_ids: list[int]):
    for index, m_id in enumerate(milestone_ids):
        db.query(GlobalMilestone).filter(GlobalMilestone.id == m_id).update({"order": index})
    db.commit()
    return True

def seed_default_milestones(db: Session):
    # This seeds your EXACT requested 100% structure
    defaults = [
        ("Pre_Requisites for DMS Implementation", "DMS Implementation", 20.0, 1),
        ("Technical Transfer document from Sales team to L1", "DMS Implementation", 5.0, 2),
        ("Understanding the customer requirement & Enhancements", "DMS Implementation", 10.0, 3),
        ("Identify the key stakeholders", "DMS Implementation", 3.0, 4),
        ("Identify Server specifications, network, SMTP details", "DMS Implementation", 2.0, 5),
        
        ("Preparation of DMS implementation plan", "Planning", 10.0, 6),
        
        ("MSI installation", "Configuration", 2.0, 7),
        ("Creation of Room Structures", "Configuration", 5.0, 8),
        ("Creation of Document Types", "Configuration", 3.0, 9),
        ("Index Fields with required Masking", "Configuration", 2.0, 10),
        ("Advanced search and FTS", "Configuration", 3.0, 11),
        ("Security Rights", "Configuration", 2.0, 12),
        ("SMTP Email Notifications", "Configuration", 5.0, 13),
        ("Workflow", "Configuration", 8.0, 14),
        ("AD/LDAP", "Configuration", 5.0, 15),
        ("SSL Certification", "Configuration", 5.0, 16),
        
        ("Testing and test reports", "Testing", 10.0, 17),
        ("Test Result documentation and SOP documentation", "Testing", 0.0, 18),
        
        ("Introduction to Contentverse", "Training", 0.0, 19),
        ("Creation of Room Structure (Cabinets/Folders)", "Training", 0.0, 20),
        ("Assign Permissions to users", "Training", 0.0, 21),
        ("Uploading Documents", "Training", 0.0, 22),
        ("Annotations", "Training", 0.0, 23),
        ("Version/Revision", "Training", 0.0, 24),
        ("Comments & References", "Training", 0.0, 25),
        ("Checkout & Check in", "Training", 0.0, 26),
        ("Export through Email", "Training", 0.0, 27),
        ("Advance Search", "Training", 0.0, 28),
        ("Full Text Search", "Training", 0.0, 29),
        ("Input Tray", "Training", 0.0, 30),
        ("Document Retention", "Training", 0.0, 31),
        ("Workflow Training", "Training", 0.0, 32),
        
        ("Administrator Training", "Admin Training", 0.0, 33),
        ("Creation of Document Types (Admin)", "Admin Training", 0.0, 34),
        ("Storage Management", "Admin Training", 0.0, 35),
        ("Audit Trail", "Admin Training", 0.0, 36),
        ("Connected Users", "Admin Training", 0.0, 37),
        ("Locked Documents", "Admin Training", 0.0, 38),
        ("Recycled Documents", "Admin Training", 0.0, 39),
        ("Statistics", "Admin Training", 0.0, 40),
        ("Template", "Admin Training", 0.0, 41),
        ("Backup", "Admin Training", 0.0, 42),
        ("Restore Procedure", "Admin Training", 0.0, 43),
        ("Redactions", "Admin Training", 0.0, 44),
        ("Creating Users & Groups", "Admin Training", 0.0, 45),
        ("Creation of workflow (Admin)", "Admin Training", 0.0, 46),
        ("Generation of workflow reports", "Admin Training", 0.0, 47),
        
        ("Customer sign off Document", "Sign Off", 10.0, 48),
    ]
    for name, section, weight, order in defaults:
        db.add(GlobalMilestone(task_name=name, section=section, weight=weight, order=order))
    db.commit()
