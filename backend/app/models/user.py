import enum

from sqlalchemy import Column, DateTime, Enum, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


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
    software_access = Column(
        Enum(SoftwareAccess), nullable=False, default=SoftwareAccess.BOTH
    )
    hashed_password = Column(String, nullable=False)
    last_logout = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String, default="UTC", nullable=False)
