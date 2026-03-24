from sqlalchemy.orm import Session
from app.models.location import Location
from app.models.task import Task
from app.schemas.location import LocationCreate, LocationUpdate

def get_locations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Location).offset(skip).limit(limit).all()

def get_locations_by_user(db: Session, user_id: int):
    return db.query(Location).join(Task).filter(Task.assigned_to == user_id).distinct().all()

def get_locations_by_client(db: Session, client_id: int):
    return db.query(Location).filter(Location.client_id == client_id).all()

def get_location(db: Session, location_id: int):
    return db.query(Location).filter(Location.id == location_id).first()

def create_location(db: Session, location: LocationCreate):
    db_location = Location(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

def update_location(db: Session, location_id: int, location: LocationUpdate):
    db_location = get_location(db, location_id)
    if db_location:
        update_data = location.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_location, key, value)
        db.commit()
        db.refresh(db_location)
    return db_location

def delete_location(db: Session, location_id: int):
    db_location = get_location(db, location_id)
    if db_location:
        db.delete(db_location)
        db.commit()
    return db_location
