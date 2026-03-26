from pydantic import BaseModel
from typing import Optional
from app.models.user import UserRole, SoftwareAccess

class UserBase(BaseModel):
    name: str
    role: UserRole
    software_access: SoftwareAccess = SoftwareAccess.BOTH

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

class UserPasswordReset(BaseModel):
    new_password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    software_access: Optional[SoftwareAccess] = None
    password: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[int] = None
    role: Optional[UserRole] = None
    software_access: Optional[SoftwareAccess] = None
