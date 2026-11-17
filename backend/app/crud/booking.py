from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.booking import Booking, BookingServiceItem


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
            joinedload(Booking.service_provider),
            joinedload(Booking.preferred_service_provider),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.service_provider),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.member),
            selectinload(Booking.group_members),
        )
        .filter(Booking.branch_id == branch_id)
    )

    if status_filter:
        query = query.filter(Booking.status == status_filter)

    total = query.count()

    bookings = (
        query.order_by(Booking.created_at.desc(), Booking.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    for booking in bookings:
        if booking.group_reference and booking.service_items:
            booking.service.name = ", ".join(item.service.name for item in booking.service_items if item.service)
            booking.service.price = sum(float(item.service_price if item.service_price is not None else item.service.price) for item in booking.service_items if item.service)
            booking.service.duration_minutes = sum(int(item.service_duration_minutes or item.service.duration_minutes or 0) for item in booking.service_items if item.service)

    return bookings, total


def get_booking_by_id(db: Session, booking_id: int, branch_id: int) -> Optional[Booking]:
    return (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.branch),
            joinedload(Booking.service),
            joinedload(Booking.service_provider),
            joinedload(Booking.preferred_service_provider),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.service_provider),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.member),
            selectinload(Booking.group_members),
        )
        .filter(Booking.id == booking_id, Booking.branch_id == branch_id)
        .first()
    )


def update_booking_status(db: Session, booking: Booking, new_status: str) -> Booking:
    booking.status = new_status
    booking.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)
    if booking.group_reference:
        booking = get_booking_by_id(db, booking.id, booking.branch_id)
    return booking
