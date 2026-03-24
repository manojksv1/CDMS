from pydantic import BaseModel
from typing import Optional

class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    hostname: Optional[str] = None

class LocationCreate(LocationBase):
    client_id: int

class LocationUpdate(LocationBase):
    name: Optional[str] = None

class LocationResponse(LocationBase):
    id: int
    client_id: int

    class Config:
        from_attributes = True
