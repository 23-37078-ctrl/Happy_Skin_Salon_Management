from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from app.core.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    address    = Column(String(255), nullable=False)
    phone      = Column(String(20), nullable=True)
    is_active  = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())