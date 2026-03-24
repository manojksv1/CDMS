from pydantic import BaseModel
from typing import Optional

class ClientBase(BaseModel):
    name: str
    contact_info: Optional[str] = None
    database_type: Optional[str] = None
    database_version: Optional[str] = None
    remarks: Optional[str] = None
    tags: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    name: Optional[str] = None

class ClientResponse(ClientBase):
    id: int

    class Config:
        from_attributes = True
