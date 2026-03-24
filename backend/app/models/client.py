from sqlalchemy import Column, Integer, String
from app.core.database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    contact_info = Column(String, nullable=True)
    database_type = Column(String, nullable=True)
    database_version = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
    tags = Column(String, nullable=True)