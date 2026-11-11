from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func

from app.core.database import Base


class GCashPaymentSubmission(Base):
    """Private proof and immutable decision history for a GCash submission."""

    __tablename__ = "gcash_payment_submissions"
    __table_args__ = (UniqueConstraint("reference_number", name="uq_gcash_submission_reference"),)

    id = Column(Integer, primary_key=True)
    booking_payment_id = Column(Integer, ForeignKey("booking_payments.id", ondelete="CASCADE"), nullable=False, index=True)
    reference_number = Column(String(80), nullable=False)
    reported_paid_at = Column(DateTime(timezone=True), nullable=False)
    proof_path = Column(String(500), nullable=False)
    proof_content_type = Column(String(50), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="for_verification")
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decision = Column(String(20), nullable=True)
    remarks = Column(String(1000), nullable=True)
