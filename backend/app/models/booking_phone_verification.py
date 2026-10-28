from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class BookingPhoneVerification(Base):
    __tablename__ = "booking_phone_verifications"

    id = Column(String(36), primary_key=True)
    phone_number = Column(String(20), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    consumed_at = Column(DateTime, nullable=True)
