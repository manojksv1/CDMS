from sqlalchemy import Column, Integer, String, Enum, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class TaskStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    build_version = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.NOT_STARTED, nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_date = Column(Date, nullable=False)
    dependency_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)

    location = relationship("Location", backref="tasks")
    assignee = relationship("User", backref="tasks")
    dependency_task = relationship("Task", remote_side=[id])