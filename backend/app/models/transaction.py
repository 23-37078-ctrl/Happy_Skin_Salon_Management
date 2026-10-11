from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("booking_id", name="uq_transactions_booking_id"),
        UniqueConstraint("idempotency_key", name="uq_transactions_idempotency_key"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    booking_id      = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    idempotency_key = Column(String(80), nullable=True)
    staff_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    service_provider_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    amount          = Column(Float, nullable=False)
    payment_method  = Column(String(30), default="cash", nullable=False)
    additional_charge = Column(Float, default=0, nullable=False)
    charge_reason   = Column(String(150), nullable=True)
    commission_rate = Column(Float, default=0, nullable=False)
    commission_amount = Column(Float, default=0, nullable=False)

    created_at      = Column(DateTime, server_default=func.now(), nullable=False)

    booking         = relationship("Booking")
    staff           = relationship("User", foreign_keys=[staff_id])
    service_provider = relationship("User", foreign_keys=[service_provider_id])
