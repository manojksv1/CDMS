from sqlalchemy.orm import Session
from app.models.implementation import Implementation, ImplementationLog, ImplementationTask
from app.models.client import Client
from app.schemas.implementation import ImplementationCreate, ImplementationUpdate, ImplementationLogCreate, ImplementationTaskCreate
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
    
    # Initialize with default tasks from template
    default_tasks = [
        ("Pre_Requisites for DMS Implementation", 0.2),
        ("Technical Transfer document from Sales team to L1 DMS implementation owner", 5.0),
        ("Understanding the customer requirement-(In scope/Not in scope) and Enhancements", 10.0),
        ("Identify the key stakeholders", 3.0),
        ("Identify Server specifications, network specifications, SMTP details", 2.0),
        ("Preparation of DMS implementation plan", 0.1),
        ("Contentverse Installation and Configuration", 0.4),
        ("MSI installation", 2.0),
        ("Creation of Room Structures", 5.0),
        ("Creation of Document Types", 3.0),
        # Add more if needed from full template
    ]
    
    for name, weight in default_tasks:
        db_task = ImplementationTask(implementation_id=db_imp.id, task_name=name, weight=weight)
        db.add(db_task)
    
    db.commit()
    return db_imp

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
