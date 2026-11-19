"""Shared branch scheduling rules for online reservations and staff bookings."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import update

from app.models.booking import Booking, BookingServiceItem
from app.models.branch import Branch
from app.models.user import User
from app.models.service import Service
from app.core.database import Base

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


def _qualified_staff_ids(db: Session, branch_id: int, service, staff_ids: list[int] | None = None) -> list[int]:
    """Use an explicit staff-service mapping when one exists in the application's SQLAlchemy metadata."""
    ids = staff_ids if staff_ids is not None else _staff_ids(db, branch_id)
    service_name = " ".join((service.name or "").casefold().split())
    nurse_required = service_name in {"face / chin", "arms", "tummy", "face + arms + tummy"} or "lemon bottle" in service_name
    if nurse_required:
        nurse_ids = {row[0] for row in db.query(User.id).filter(
            User.id.in_(ids), User.job_title.ilike("%nurse%")
        ).all()} if ids else set()
        ids = [provider_id for provider_id in ids if provider_id in nurse_ids]
    for relationship in Service.__mapper__.relationships:
        if relationship.mapper.class_ is User:
            association = getattr(service, relationship.key, None)
            if association is not None:
                qualified_ids = {member.id for member in association}
                return [provider_id for provider_id in ids if provider_id in qualified_ids]
        if relationship.mapper.class_.__name__.casefold() in {"servicequalification", "staffservice", "userqualification"}:
            qualification_table = relationship.mapper.local_table
            service_fk = next((column for column in qualification_table.columns if column.name in {"service_id", "serviceid"}), None)
            provider_fk = next((column for column in qualification_table.columns if column.name in {"user_id", "staff_id", "provider_id"}), None)
            if service_fk is not None and provider_fk is not None:
                qualified_ids = {row[0] for row in db.query(provider_fk).filter(service_fk == service.id).all()}
                return [provider_id for provider_id in ids if provider_id in qualified_ids]
    mapped_tables = {table.name: table for table in Base.metadata.tables.values()}
    for table_name in ("service_staff", "staff_services", "service_providers", "service_qualifications", "staff_service_qualifications"):
        table = mapped_tables.get(table_name)
        if table is None:
            continue
        service_fk = next((column for column in table.columns if column.name == "service_id"), None)
        provider_fk = next((column for column in table.columns if column.name in {"user_id", "staff_id", "provider_id", "service_provider_id"}), None)
        if service_fk is not None and provider_fk is not None:
            qualified_ids = {row[0] for row in db.query(provider_fk).filter(service_fk == service.id).all()}
            return [provider_id for provider_id in ids if provider_id in qualified_ids]
    return ids


def _provider_busy_intervals(bookings: list[Booking]) -> dict[int, list[tuple[datetime, datetime]]]:
    busy: dict[int, list[tuple[datetime, datetime]]] = {}
    for booking in bookings:
        cursor = _as_local(booking.appointment_date)
        items = booking.service_items or []
        if items:
            for item in items:
                if item.status in {"completed", "cancelled"}:
                    continue
                item_start = _as_local(item.appointment_start) if item.appointment_start else cursor
                end = _as_local(item.appointment_end) if item.appointment_end else item_start + timedelta(minutes=_duration(item.service))
                provider_id = item.service_provider_id or booking.service_provider_id
                if provider_id:
                    busy.setdefault(provider_id, []).append((item_start, end))
                if not item.appointment_start:
                    cursor = end
        elif booking.service:
            end = cursor + timedelta(minutes=_duration(booking.service))
            if booking.service_provider_id:
                busy.setdefault(booking.service_provider_id, []).append((cursor, end))
    return busy


def assign_providers(db: Session, branch_id: int, start: datetime, services: list, requested_provider_ids: dict[int, int] | list[int | None] | None = None,
                     exclude_booking_id: int | None = None, *, online: bool = False) -> list[int]:
    """Return a provider per sequential service, or raise a scheduling conflict."""
    local_start = _as_local(start)
    day_bookings = _daily_bookings(db, branch_id, local_start.date(), exclude_booking_id)
    staff_ids = _staff_ids(db, branch_id)
    busy = _provider_busy_intervals(day_bookings)
    requested_provider_ids = requested_provider_ids or {}
    cursor = local_start
    assignments: list[int] = []
    for index, service in enumerate(services):
        duration = _duration(service)
        end = cursor + timedelta(minutes=duration)
        requested_id = requested_provider_ids[index] if isinstance(requested_provider_ids, list) and index < len(requested_provider_ids) else requested_provider_ids.get(service.id) if isinstance(requested_provider_ids, dict) else None
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


def validate_group_booking_schedule(
    db: Session,
    branch_id: int,
    start: datetime,
    member_services: list[list],
    *,
    online: bool = True,
    staff_ids: list[int] | None = None,
    day_bookings: list[Booking] | None = None,
) -> list[tuple[int, datetime, datetime]]:
    """Schedule each member's services in sequence and members concurrently when staff permits."""
    local_start = _as_local(start)
    now = datetime.now(BUSINESS_TIMEZONE)
    if local_start.date() < now.date():
        raise HTTPException(status_code=400, detail="Appointments cannot be scheduled in the past.")
    if online and local_start < now + ONLINE_LEAD_TIME:
        raise HTTPException(status_code=400, detail="Online appointments must be booked at least 30 minutes in advance.")
    if not online and local_start < now:
        raise HTTPException(status_code=400, detail="Walk-in appointments cannot be scheduled for a time that has passed.")
    if local_start.time() < OPENING_TIME or local_start.time() > LAST_START_TIME:
        raise HTTPException(status_code=400, detail="Appointment start times are available from 11:00 AM to 8:00 PM.")
    if online and (local_start.minute % SLOT_INTERVAL_MINUTES != 0 or local_start.second or local_start.microsecond):
        raise HTTPException(status_code=400, detail="Choose a 20-minute appointment time slot.")

    scheduled: list[tuple[int, int, int, object, datetime, datetime]] = []
    closing = datetime.combine(local_start.date(), CLOSING_TIME, BUSINESS_TIMEZONE)
    for member_index, services in enumerate(member_services):
        cursor = local_start
        for service_index, service in enumerate(services):
            end = cursor + timedelta(minutes=_duration(service))
            if end > closing:
                raise HTTPException(status_code=400, detail="The group services would finish after the salon closes at 9:00 PM.")
            scheduled.append((len(scheduled), member_index, service_index, service, cursor, end))
            cursor = end

    scheduled.sort(key=lambda item: (item[4], item[1], item[2]))
    branch_staff_ids = staff_ids if staff_ids is not None else _staff_ids(db, branch_id)
    bookings_for_day = day_bookings if day_bookings is not None else _daily_bookings(db, branch_id, local_start.date())
    busy = _provider_busy_intervals(bookings_for_day)
    assignments: list[tuple[int, datetime, datetime] | None] = [None] * len(scheduled)
    provider_intervals: dict[int, list[tuple[datetime, datetime]]] = {}
    for original_position, _member_index, _service_index, service, item_start, item_end in scheduled:
        available_provider = next((provider_id for provider_id in _qualified_staff_ids(db, branch_id, service, branch_staff_ids) if not any(
            occupied_start < item_end and occupied_end > item_start
            for occupied_start, occupied_end in [*busy.get(provider_id, []), *provider_intervals.get(provider_id, [])]
        )), None)
        if available_provider is None:
            raise HTTPException(status_code=409, detail="There are not enough available qualified staff members to serve the entire group at this time.")
        provider_intervals.setdefault(available_provider, []).append((item_start, item_end))
        assignments[original_position] = (available_provider, item_start, item_end)
    return [assignment for assignment in assignments if assignment is not None]


def validate_booking_schedule(db: Session, branch_id: int, start: datetime, services: list, *, online: bool,
                              requested_provider_ids: dict[int, int] | list[int | None] | None = None,
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
