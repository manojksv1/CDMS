from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.task import Task, TaskStatus
from app.models.location import Location
from app.models.client import Client
from datetime import date, timedelta
from app.schemas.dashboard import DashboardSummary, ClientProgress, LocationProgress, DelayedTaskDetail

from app.models.implementation import Implementation
from app.models.user import User, UserRole

def get_dashboard_summary(db: Session, user: User) -> DashboardSummary:
    # Helper to avoid repetitive queries for client names
    def get_client_name_for_task(task_id: int) -> str:
        task = db.query(Task).get(task_id)
        if task and task.location and task.location.client:
            return task.location.client.name
        return "Unknown Client"

    # 1. Installation Tracker Data
    client_query = db.query(Client)
    loc_query = db.query(Location)
    task_query = db.query(Task)
    
    if user.role == UserRole.ENGINEER:
        client_query = client_query.join(Location).join(Task).filter(Task.assigned_to == user.id).distinct()
        loc_query = loc_query.join(Task).filter(Task.assigned_to == user.id).distinct()
        task_query = task_query.filter(Task.assigned_to == user.id)

    total_clients = client_query.count()
    total_locations = loc_query.count()
    total_tasks = task_query.count()
    completed_tasks = task_query.filter(Task.status == TaskStatus.COMPLETED).count()
    
    delayed_tasks_query = task_query.filter(Task.due_date < date.today(), Task.status != TaskStatus.COMPLETED)
    delayed_tasks_count = delayed_tasks_query.count()
    delayed_task_details = [get_client_name_for_task(t.id) for t in delayed_tasks_query.limit(10).all()] # Limit to 10 for performance
    
    overall_progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0

    # 2. Implementation Tracker Data
    imp_query = db.query(Implementation)
    if user.role == UserRole.ENGINEER:
        imp_query = imp_query.filter(Implementation.assigned_user_id == user.id)
    
    implementations = imp_query.all()
    total_imps = len(implementations)
    
    live_imps = [i.company_name for i in implementations if i.status == "Live"]
    stagnant_details = []
    in_progress_details = []
    
    three_days_ago = date.today() - timedelta(days=3)
    status_counts = {"InProgress": 0, "OnHold": 0, "Live": 0, "Completed": 0}
    
    for i in implementations:
        status_counts[i.status] = status_counts.get(i.status, 0) + 1
        
        if i.status == "InProgress":
            in_progress_details.append(i.company_name)
        
        if i.status in ["InProgress", "OnHold"]:
            from app.models.implementation import ImplementationLog
            last_log = db.query(ImplementationLog).filter(
                ImplementationLog.implementation_id == i.id
            ).order_by(ImplementationLog.date.desc()).first()
            
            if not last_log or last_log.date < three_days_ago:
                stagnant_details.append(i.company_name)

    return DashboardSummary(
        total_clients=total_clients,
        total_locations=total_locations,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        delayed_tasks=delayed_tasks_count,
        overall_progress=round(overall_progress, 2),
        total_implementations=total_imps,
        live_implementations=len(live_imps),
        stagnant_implementations=len(stagnant_details),
        implementations_by_status=status_counts,
        # Details for tooltips
        live_implementation_details=live_imps,
        stagnant_implementation_details=stagnant_details,
        delayed_task_details=list(set(delayed_task_details)), # Unique client names
        in_progress_implementation_details=in_progress_details
    )

def get_delayed_tasks(db: Session, user: User):
    task_query = db.query(Task).filter(
        Task.due_date < date.today(),
        Task.status != TaskStatus.COMPLETED
    )
    
    if user.role == UserRole.ENGINEER:
        task_query = task_query.filter(Task.assigned_to == user.id)

    delayed_tasks_query = task_query.all()

    result = []
    for task in delayed_tasks_query:
        location = db.query(Location).filter(Location.id == task.location_id).first()
        client = db.query(Client).filter(Client.id == location.client_id).first()
        days_delayed = (date.today() - task.due_date).days

        result.append(DelayedTaskDetail(
            task=task,
            location=location,
            client=client,
            days_delayed=days_delayed
        ))
    return result

def get_client_progress(db: Session, client_id: int, user: User) -> ClientProgress:
    client = db.query(Client).filter(Client.id == client_id).first()
    
    loc_query = db.query(Location).filter(Location.client_id == client_id)
    if user.role == UserRole.ENGINEER:
        loc_query = loc_query.join(Task).filter(Task.assigned_to == user.id).distinct()
    
    locations = loc_query.all()
    
    loc_progress_list = []
    for loc in locations:
        task_query = db.query(Task).filter(Task.location_id == loc.id)
        if user.role == UserRole.ENGINEER:
            task_query = task_query.filter(Task.assigned_to == user.id)
            
        total_tasks = task_query.count()
        completed_tasks = task_query.filter(Task.status == TaskStatus.COMPLETED).count()
        progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
        
        loc_progress_list.append(LocationProgress(
            location_id=loc.id,
            location_name=loc.name,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            progress_percentage=round(progress, 2)
        ))
        
    total_locs = len(loc_progress_list)
    overall_progress = sum([lp.progress_percentage for lp in loc_progress_list]) / total_locs if total_locs > 0 else 0.0
    
    return ClientProgress(
        client_id=client.id,
        client_name=client.name,
        locations_progress=loc_progress_list,
        overall_progress_percentage=round(overall_progress, 2)
    )

def get_all_clients_progress(db: Session, user: User):
    client_query = db.query(Client)
    if user.role == UserRole.ENGINEER:
        client_query = client_query.join(Location).join(Task).filter(Task.assigned_to == user.id).distinct()
        
    clients = client_query.all()
    return [get_client_progress(db, client.id, user) for client in clients]