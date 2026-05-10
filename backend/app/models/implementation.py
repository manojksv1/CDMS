from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Implementation(Base):
    __tablename__ = "implementations"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    zone = Column(String, nullable=True)
    assigned_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Project Metadata
    po_date = Column(Date, nullable=True)
    poc_1 = Column(String, nullable=True)
    poc_2 = Column(String, nullable=True)
    license_uat = Column(String, nullable=True)
    license_prod = Column(String, nullable=True)
    uat_version = Column(String, nullable=True)
    prod_version = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    expected_end_date = Column(Date, nullable=True)

    # Current Status
    status = Column(String, default="InProgress")
    status_remarks = Column(String, nullable=True)
    current_percentage = Column(Float, default=0.0)
    # server_default ensures the DB sets this, not Python — avoids class-level evaluation
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    logs = relationship(
        "ImplementationLog",
        backref="implementation",
        cascade="all, delete-orphan",
        order_by="desc(ImplementationLog.date)",
    )
    tasks = relationship(
        "ImplementationTask",
        backref="implementation",
        cascade="all, delete-orphan",
        order_by="ImplementationTask.id",
    )
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])


class ImplementationLog(Base):
    __tablename__ = "implementation_logs"

    id = Column(Integer, primary_key=True, index=True)
    implementation_id = Column(
        Integer,
        ForeignKey("implementations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    date = Column(Date, nullable=False)
    # server_default avoids the class-level datetime.utcnow() evaluation bug
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    remarks = Column(String, nullable=False)
    percentage_at_time = Column(Float, nullable=True)
    milestone_stage = Column(String, nullable=True)

    user = relationship("User")


class ImplementationTask(Base):
    __tablename__ = "implementation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    implementation_id = Column(
        Integer,
        ForeignKey("implementations.id", ondelete="CASCADE"),
        nullable=False,
    )

    task_name = Column(String, nullable=False)
    section_name = Column(String, nullable=True)
    weight = Column(Float, nullable=False)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True)


class MilestoneSection(Base):
    __tablename__ = "milestone_sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    weight = Column(Float, nullable=False)
    order = Column(Integer, default=0)

    milestones = relationship(
        "GlobalMilestone",
        back_populates="section",
        cascade="all, delete-orphan",
    )


class GlobalMilestone(Base):
    __tablename__ = "global_milestones"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(
        Integer,
        ForeignKey("milestone_sections.id", ondelete="CASCADE"),
        nullable=True,
    )
    task_name = Column(String, nullable=False)
    weight = Column(Float, nullable=False)
    order = Column(Integer, default=0)

    section = relationship("MilestoneSection", back_populates="milestones")
