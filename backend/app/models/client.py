from sqlalchemy import Column, Integer, String
from app.core.database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    contact_info = Column(String, nullable=True)
    database_type = Column(String, nullable=True)
    database_version = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    client_location = Column(String, nullable=True)
    poc_1 = Column(String, nullable=True)
    poc_2 = Column(String, nullable=True)
    license_uat = Column(String, nullable=True)
    license_prod = Column(String, nullable=True)
    uat_version = Column(String, nullable=True)
    prod_version = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
    tags = Column(String, nullable=True)