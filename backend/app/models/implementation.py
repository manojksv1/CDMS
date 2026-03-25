from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class Implementation(Base):
    __tablename__ = "implementations"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    zone = Column(String, nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Project Metadata
    po_date = Column(Date, nullable=True)
    poc_name = Column(String, nullable=True)
    version_details = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    expected_end_date = Column(Date, nullable=True)
    
    # Current Status
    status = Column(String, default="InProgress") # InProgress, OnHold, Live, Completed
    current_percentage = Column(Float, default=0.0)
    
    # Relationships
    logs = relationship("ImplementationLog", backref="implementation", cascade="all, delete-orphan")
    tasks = relationship("ImplementationTask", backref="implementation", cascade="all, delete-orphan")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])

class ImplementationLog(Base):
    __tablename__ = "implementation_logs"

    id = Column(Integer, primary_key=True, index=True)
    implementation_id = Column(Integer, ForeignKey("implementations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    date = Column(Date, default=datetime.utcnow().date())
    remarks = Column(String, nullable=False)
    percentage_at_time = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class ImplementationTask(Base):
    __tablename__ = "implementation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    implementation_id = Column(Integer, ForeignKey("implementations.id", ondelete="CASCADE"), nullable=False)
    
    task_name = Column(String, nullable=False)
    weight = Column(Float, nullable=False) # e.g., 5.0 for 5%
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
