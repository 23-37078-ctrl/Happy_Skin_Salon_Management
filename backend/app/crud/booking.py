from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking


def get_bookings_for_branch(
    db: Session,
    branch_id: int,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
) -> tuple[list[Booking], int]:
    query = (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.branch),
            joinedload(Booking.service),
        )
        .filter(Booking.branch_id == branch_id)
    )

    if status_filter:
        query = query.filter(Booking.status == status_filter)

    total = query.count()

    bookings = (
        query.order_by(Booking.appointment_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return bookings, total


def get_booking_by_id(db: Session, booking_id: int, branch_id: int) -> Optional[Booking]:
    return (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.branch),
            joinedload(Booking.service),
        )
        .filter(Booking.id == booking_id, Booking.branch_id == branch_id)
        .first()
    )


def update_booking_status(db: Session, booking: Booking, new_status: str) -> Booking:
    booking.status = new_status
    booking.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)
    return booking