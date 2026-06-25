from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func
from app.core.database import Base


class Service(Base):
    __tablename__ = "services"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(100), nullable=False)
    description       = Column(String(255), nullable=True)
    price             = Column(Float, nullable=False)
    duration_minutes  = Column(Integer, nullable=True)
    image_url         = Column(String(255), nullable=True)
    is_active         = Column(Boolean, default=True, nullable=False)

    created_at        = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())