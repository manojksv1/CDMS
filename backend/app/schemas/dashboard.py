from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.schemas.task import TaskResponse
from app.schemas.location import LocationResponse
from app.schemas.client import ClientResponse

class LocationProgress(BaseModel):
    location_id: int
    location_name: str
    total_tasks: int
    completed_tasks: int
    progress_percentage: float

class ClientProgress(BaseModel):
    client_id: int
    client_name: str
    locations_progress: List[LocationProgress]
    overall_progress_percentage: float

class DashboardSummary(BaseModel):
    # Installation Tracker Stats (Current)
    total_clients: int
    total_locations: int
    total_tasks: int
    completed_tasks: int
    delayed_tasks: int
    overall_progress: float

    # Implementation Tracker Stats (New)
    total_implementations: int
    live_implementations: int
    stagnant_implementations: int
    implementations_by_status: dict

    # Details for Tooltips
    live_implementation_details: List[str] = []
    stagnant_implementation_details: List[str] = []
    delayed_task_details: List[str] = []
    in_progress_implementation_details: List[str] = []

class DelayedTaskDetail(BaseModel):
    task: TaskResponse
    location: LocationResponse
    client: ClientResponse
    days_delayed: int

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    summary_type: str = 'implementation'
    client_id: Optional[int] = None
    history: Optional[List[ChatMessage]] = None

class ChatResponse(BaseModel):
    reply: str
