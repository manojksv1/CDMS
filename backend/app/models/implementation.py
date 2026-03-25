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
    section_name = Column(String, nullable=True) # Keeping for display simplicity
    weight = Column(Float, nullable=False)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

class MilestoneSection(Base):
    __tablename__ = "milestone_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    weight = Column(Float, nullable=False) # e.g. 30.0 for 30%
    order = Column(Integer, default=0)
    
    milestones = relationship("GlobalMilestone", back_populates="section", cascade="all, delete-orphan")

class GlobalMilestone(Base):
    __tablename__ = "global_milestones"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("milestone_sections.id", ondelete="CASCADE"), nullable=True)
    task_name = Column(String, nullable=False)
    weight = Column(Float, nullable=False) # Weight relative to total project (e.g. 5.0)
    order = Column(Integer, default=0)
    
    section = relationship("MilestoneSection", back_populates="milestones")
