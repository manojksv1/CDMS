from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary, ClientProgress, DelayedTaskDetail
from app.services import dashboard_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return dashboard_service.get_dashboard_summary(db, current_user)

@router.get("/delays", response_model=List[DelayedTaskDetail])
def get_delays(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return dashboard_service.get_delayed_tasks(db, current_user)

@router.get("/progress/clients", response_model=List[ClientProgress])
def get_all_progress(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return dashboard_service.get_all_clients_progress(db, current_user)

@router.get("/progress/clients/{client_id}", response_model=ClientProgress)
def get_client_progress(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return dashboard_service.get_client_progress(db, client_id, current_user)
