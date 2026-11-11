"""Shared branch scheduling rules for online reservations and staff bookings."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import update

from app.models.booking import Booking, BookingServiceItem
from app.models.branch import Branch
from app.models.user import User

BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")
OPENING_TIME = time(11, 0)
LAST_START_TIME = time(20, 0)
CLOSING_TIME = time(21, 0)
ONLINE_LEAD_TIME = timedelta(minutes=30)
SLOT_INTERVAL_MINUTES = 20
ACTIVE_BOOKING_STATUSES = {"pending", "confirmed"}


def _as_local(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(BUSINESS_TIMEZONE)


def _services(booking: Booking):
    return [item.service for item in booking.service_items if item.service] or ([booking.service] if booking.service else [])


def _duration(service) -> int:
    return max(1, int(service.duration_minutes or 0))


def _daily_bookings(db: Session, branch_id: int, day: date, exclude_booking_id: int | None = None):
    start = datetime.combine(day, time.min, BUSINESS_TIMEZONE).astimezone(timezone.utc)
    end = start + timedelta(days=1)
    query = db.query(Booking).options(
        joinedload(Booking.service),
        selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
    ).filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end,
             Booking.status.in_(ACTIVE_BOOKING_STATUSES))
    if exclude_booking_id is not None:
        query = query.filter(Booking.id != exclude_booking_id)
    return query.all()


def _staff_ids(db: Session, branch_id: int) -> list[int]:
    return [row[0] for row in db.query(User.id).filter(
        User.role == "staff", User.branch_id == branch_id, User.is_active.is_(True), User.job_title.isnot(None)
    ).all()]


def _provider_busy_intervals(bookings: list[Booking]) -> dict[int, list[tuple[datetime, datetime]]]:
    busy: dict[int, list[tuple[datetime, datetime]]] = {}
    for booking in bookings:
        cursor = _as_local(booking.appointment_date)
        items = booking.service_items or []
        if items:
            for item in items:
                end = cursor + timedelta(minutes=_duration(item.service))
                provider_id = item.service_provider_id or booking.service_provider_id
                if provider_id:
                    busy.setdefault(provider_id, []).append((cursor, end))
                cursor = end
        elif booking.service:
            end = cursor + timedelta(minutes=_duration(booking.service))
            if booking.service_provider_id:
                busy.setdefault(booking.service_provider_id, []).append((cursor, end))
    return busy


def assign_providers(db: Session, branch_id: int, start: datetime, services: list, requested_provider_ids: dict[int, int] | None = None,
                     exclude_booking_id: int | None = None, *, online: bool = False) -> list[int]:
    """Return a provider per sequential service, or raise a scheduling conflict."""
    local_start = _as_local(start)
    day_bookings = _daily_bookings(db, branch_id, local_start.date(), exclude_booking_id)
    staff_ids = _staff_ids(db, branch_id)
    busy = _provider_busy_intervals(day_bookings)
    requested_provider_ids = requested_provider_ids or {}
    cursor = local_start
    assignments: list[int] = []
    for service in services:
        duration = _duration(service)
        end = cursor + timedelta(minutes=duration)
        requested_id = requested_provider_ids.get(service.id)
        candidates = [requested_id] if requested_id else staff_ids
        provider_id = next((candidate for candidate in candidates if candidate in staff_ids and not any(
            existing_start < end and existing_end > cursor for existing_start, existing_end in busy.get(candidate, [])
        )), None)
        if provider_id is None:
            message = "The selected provider is unavailable for the full service duration." if requested_id else "No available staff member can accommodate this service at that time."
            raise HTTPException(status_code=409, detail=message)
        assignments.append(provider_id)
        busy.setdefault(provider_id, []).append((cursor, end))
        cursor = end
    return assignments


def validate_booking_schedule(db: Session, branch_id: int, start: datetime, services: list, *, online: bool,
                              requested_provider_ids: dict[int, int] | None = None,
                              exclude_booking_id: int | None = None) -> list[int]:
    local_start = _as_local(start)
    now = datetime.now(BUSINESS_TIMEZONE)
    if local_start.date() != now.date() and local_start.date() < now.date():
        raise HTTPException(status_code=400, detail="Appointments cannot be scheduled in the past.")
    if online and local_start < now + ONLINE_LEAD_TIME:
        raise HTTPException(status_code=400, detail="Online appointments must be booked at least 30 minutes in advance.")
    if not online and local_start < now:
        raise HTTPException(status_code=400, detail="Walk-in appointments cannot be scheduled for a time that has passed.")
    if local_start.time() < OPENING_TIME or local_start.time() > LAST_START_TIME:
        raise HTTPException(status_code=400, detail="Appointment start times are available from 11:00 AM to 8:00 PM.")
    if online and (local_start.minute % SLOT_INTERVAL_MINUTES != 0 or local_start.second or local_start.microsecond):
        raise HTTPException(status_code=400, detail="Choose a 20-minute appointment time slot.")
    end = local_start + timedelta(minutes=sum(_duration(service) for service in services))
    closing = datetime.combine(local_start.date(), CLOSING_TIME, BUSINESS_TIMEZONE)
    if end > closing:
        raise HTTPException(status_code=400, detail="This service would finish after the salon closes at 9:00 PM.")
    return assign_providers(db, branch_id, local_start, services, requested_provider_ids, exclude_booking_id, online=online)


def get_day_bookings(db: Session, branch_id: int, day: date):
    return _daily_bookings(db, branch_id, day)


def lock_branch_schedule(db: Session, branch_id: int) -> bool:
    """Serialize availability checks and writes for a branch."""
    query = db.query(Branch).filter(Branch.id == branch_id, Branch.is_active.is_(True))
    if db.get_bind().dialect.name == "sqlite":
        db.execute(update(Booking).values(id=Booking.id))
        query = query.populate_existing()
    else:
        query = query.with_for_update()
    return query.first() is not None
