from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id               = Column(Integer, primary_key=True, index=True)
    customer_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=False)
    service_id       = Column(Integer, ForeignKey("services.id"), nullable=False)

    appointment_date = Column(DateTime, nullable=False)
    status           = Column(String(20), default="pending", nullable=False)
    # status values: pending | confirmed | completed | cancelled

    notes            = Column(String(255), nullable=True)

    created_at       = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer         = relationship("User", foreign_keys=[customer_id])
    branch           = relationship("Branch")
    service          = relationship("Service")