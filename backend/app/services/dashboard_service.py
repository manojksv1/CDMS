from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.task import Task, TaskStatus
from app.models.location import Location
from app.models.client import Client
from datetime import date
from app.schemas.dashboard import DashboardSummary, ClientProgress, LocationProgress, DelayedTaskDetail

from app.models.user import User, UserRole

def get_dashboard_summary(db: Session, user: User) -> DashboardSummary:
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
    
    # Delayed: due_date < today and status != COMPLETED
    delayed_tasks = task_query.filter(
        Task.due_date < date.today(),
        Task.status != TaskStatus.COMPLETED
    ).count()

    overall_progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0

    return DashboardSummary(
        total_clients=total_clients,
        total_locations=total_locations,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        delayed_tasks=delayed_tasks,
        overall_progress=round(overall_progress, 2)
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