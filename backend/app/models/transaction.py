from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id              = Column(Integer, primary_key=True, index=True)
    booking_id      = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    staff_id        = Column(Integer, ForeignKey("users.id"), nullable=False)

    amount          = Column(Float, nullable=False)
    payment_method  = Column(String(30), default="cash", nullable=False)

    created_at      = Column(DateTime, server_default=func.now(), nullable=False)

    booking         = relationship("Booking")
    staff           = relationship("User", foreign_keys=[staff_id])