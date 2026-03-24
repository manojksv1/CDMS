from fastapi import APIRouter
from app.api import auth, users, clients, locations, tasks, dashboard, comments, system

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(comments.router, prefix="/comments", tags=["comments"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
