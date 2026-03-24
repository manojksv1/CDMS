from pydantic import BaseModel
from typing import Optional

class ClientBase(BaseModel):
    name: str
    contact_info: Optional[str] = None
    database_type: Optional[str] = None
    database_version: Optional[str] = None
    zone: Optional[str] = None
    client_location: Optional[str] = None
    poc_1: Optional[str] = None
    poc_2: Optional[str] = None
    license_uat: Optional[str] = None
    license_prod: Optional[str] = None
    uat_version: Optional[str] = None
    prod_version: Optional[str] = None
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
