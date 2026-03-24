from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse
from app.services import location_service
from app.api.deps import get_current_user, get_current_active_admin
from app.models.user import User, UserRole

router = APIRouter()

@router.post("/", response_model=LocationResponse)
def create_location(location: LocationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    return location_service.create_location(db=db, location=location)

@router.get("/", response_model=List[LocationResponse])
def read_locations(client_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if client_id:
        return location_service.get_locations_by_client(db, client_id=client_id)
    if current_user.role == UserRole.ENGINEER:
        return location_service.get_locations_by_user(db, current_user.id)
    return location_service.get_locations(db, skip=skip, limit=limit)

@router.get("/{location_id}", response_model=LocationResponse)
def read_location(location_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_location = location_service.get_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location

@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(location_id: int, location: LocationUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    db_location = location_service.update_location(db=db, location_id=location_id, location=location)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location

@router.delete("/{location_id}", response_model=LocationResponse)
def delete_location(location_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    db_location = location_service.delete_location(db=db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location
