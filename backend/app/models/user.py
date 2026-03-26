from sqlalchemy import Column, Integer, String, Enum, DateTime
from app.core.database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    ENGINEER = "ENGINEER"

class SoftwareAccess(str, enum.Enum):
    INSTALLATION = "INSTALLATION"
    IMPLEMENTATION = "IMPLEMENTATION"
    BOTH = "BOTH"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False, unique=True)
    role = Column(Enum(UserRole), nullable=False)
    software_access = Column(Enum(SoftwareAccess), nullable=False, default=SoftwareAccess.BOTH)
    hashed_password = Column(String, nullable=False)
    last_logout = Column(DateTime, nullable=True)