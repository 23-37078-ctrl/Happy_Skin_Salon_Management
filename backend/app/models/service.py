from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, func
from sqlalchemy.orm import relationship
from app.core.database import Base


branch_services = Table(
    "branch_services",
    Base.metadata,
    Column("branch_id", ForeignKey("branches.id", ondelete="CASCADE"), primary_key=True),
    Column("service_id", ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
)


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

    branches          = relationship("Branch", secondary=branch_services, back_populates="services")
