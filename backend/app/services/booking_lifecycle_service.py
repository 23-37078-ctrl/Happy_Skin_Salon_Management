"""Lifecycle handling for appointments that pass their arrival window."""

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.booking_payment import BookingPayment

BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")


def cancel_overdue_bookings(db: Session, branch_id: int | None = None) -> None:
    """Cancel overdue unarrived appointments and expire their pending payments."""
    now_utc = datetime.now(timezone.utc)
    cutoff = (now_utc - timedelta(minutes=30)).replace(tzinfo=None)
    today_start = datetime.combine(datetime.now(BUSINESS_TIMEZONE).date(), time.min, BUSINESS_TIMEZONE)
    today_start_utc = today_start.astimezone(timezone.utc).replace(tzinfo=None)
    query = db.query(Booking).filter(
        Booking.status.in_(["pending", "confirmed"]),
        or_(
            and_(
                or_(Booking.notes.is_(None), ~Booking.notes.like("Walk-in booking%")),
                Booking.appointment_date <= cutoff,
            ),
            Booking.appointment_date < today_start_utc,
        ),
        Booking.checked_in_at.is_(None),
    )
    if branch_id is not None:
        query = query.filter(Booking.branch_id == branch_id)
    overdue = query.all()
    for booking in overdue:
        payment = db.query(BookingPayment).filter(BookingPayment.booking_id == booking.id).first()
        if payment and payment.status == "creating":
            continue
        if payment and payment.status == "pending":
            payment.status = "cancelled"
        appointment_date = booking.appointment_date
        if appointment_date.tzinfo is not None:
            appointment_date = appointment_date.astimezone(timezone.utc).replace(tzinfo=None)
        booking.status = "cancelled"
        reason = (
            "appointment date has passed"
            if appointment_date < today_start_utc
            else "customer did not arrive within 30 minutes of the appointment time"
        )
        booking.notes = f"{booking.notes or ''}\nCancelled automatically: {reason}.".strip()
    if overdue:
        db.commit()
