from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)

from app.core.database import Base


class BookingPaymentAttempt(Base):
    """One PayPal order attempt; the booking payment remains the summary row."""

    __tablename__ = "booking_payment_attempts"
    __table_args__ = (
        UniqueConstraint("paypal_order_id", name="uq_booking_payment_attempts_order"),
        UniqueConstraint("paypal_capture_id", name="uq_booking_payment_attempts_capture"),
        UniqueConstraint("create_request_id", name="uq_booking_payment_attempts_create_request"),
        UniqueConstraint("capture_request_id", name="uq_booking_payment_attempts_capture_request"),
        Index("ix_booking_payment_attempts_payment_status", "booking_payment_id", "status"),
    )

    id = Column(Integer, primary_key=True)
    booking_payment_id = Column(
        Integer,
        ForeignKey("booking_payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    paypal_order_id = Column(String(80), nullable=True)
    paypal_capture_id = Column(String(80), nullable=True)
    create_request_id = Column(String(80), nullable=False)
    capture_request_id = Column(String(80), nullable=True)
    status = Column(String(20), nullable=False, default="creating")
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="PHP")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
