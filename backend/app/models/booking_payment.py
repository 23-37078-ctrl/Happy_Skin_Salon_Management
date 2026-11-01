from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from app.core.database import Base


class BookingPayment(Base):
    __tablename__ = "booking_payments"

    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True)
    provider = Column(String(30), nullable=False, default="paypal")
    checkout_session_id = Column(String(80), nullable=True, unique=True)
    checkout_url = Column(String(500), nullable=True)
    reference_number = Column(String(80), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default="creating")
    amount = Column(Float, nullable=False)
    payment_id = Column(String(80), nullable=True, unique=True)
    payment_method = Column(String(30), nullable=True)
    guest_status_token_hash = Column(String(64), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
