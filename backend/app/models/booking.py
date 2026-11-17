from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id               = Column(Integer, primary_key=True, index=True)
    customer_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_name       = Column(String(100), nullable=True)
    guest_email      = Column(String(255), nullable=True)
    guest_phone      = Column(String(20), nullable=True)
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=False)
    service_id       = Column(Integer, ForeignKey("services.id"), nullable=False)
    service_provider_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    preferred_service_provider_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    appointment_date = Column(DateTime(timezone=True), nullable=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    status           = Column(String(20), default="pending", nullable=False)
    # status values: pending | confirmed | completed | cancelled

    notes            = Column(String(255), nullable=True)
    group_reference  = Column(String(32), nullable=True, unique=True, index=True)

    created_at       = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer         = relationship("User", foreign_keys=[customer_id])
    branch           = relationship("Branch")
    service          = relationship("Service")
    service_provider = relationship("User", foreign_keys=[service_provider_id])
    preferred_service_provider = relationship("User", foreign_keys=[preferred_service_provider_id])
    service_items = relationship("BookingServiceItem", back_populates="booking", cascade="all, delete-orphan", order_by="BookingServiceItem.id")
    group_members = relationship("GroupBookingMember", back_populates="booking", cascade="all, delete-orphan", order_by="GroupBookingMember.id")


class GroupBookingMember(Base):
    __tablename__ = "group_booking_members"

    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    member_name = Column(String(100), nullable=False)
    contact_number = Column(String(20), nullable=True)
    is_booker = Column(Boolean, nullable=False, default=False)
    booking = relationship("Booking", back_populates="group_members")
    service_items = relationship("BookingServiceItem", back_populates="member")


class BookingServiceItem(Base):
    __tablename__ = "booking_service_items"
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    service_provider_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    member_id = Column(Integer, ForeignKey("group_booking_members.id", ondelete="CASCADE"), nullable=True, index=True)
    appointment_start = Column(DateTime(timezone=True), nullable=True)
    appointment_end = Column(DateTime(timezone=True), nullable=True)
    service_price = Column(Float, nullable=True)
    service_duration_minutes = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    booking = relationship("Booking", back_populates="service_items")
    service = relationship("Service")
    service_provider = relationship("User", foreign_keys=[service_provider_id])
    member = relationship("GroupBookingMember", back_populates="service_items")
