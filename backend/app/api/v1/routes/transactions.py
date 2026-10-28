from datetime import date, datetime, time, timedelta, timezone
import math
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.crud.booking import get_booking_by_id
from app.crud.transaction import create_transaction, get_transactions_for_branch
from app.dependencies.permissions import require_staff_branch
from app.models.user import User
from app.models.booking import Booking, BookingServiceItem
from app.models.branch import Branch
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.day_closure import DayClosure
from app.schemas.transaction import (
    TransactionCreateRequest,
    TransactionListResponse,
    TransactionOut,
    OnlineBookingConfirmRequest,
    WalkInBookingRequest,
    WalkInCheckoutRequest,
)
from app.schemas.booking import BookingCancellationRequest

router = APIRouter(prefix="/staff/transactions", tags=["Staff - Transactions"])
BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")
BUSINESS_OPEN_TIME = time(8, 30)
AUTOMATIC_CUTOFF_TIME = time(5, 0)


def _current_business_date() -> date:
    local_now = datetime.now(BUSINESS_TIMEZONE)
    return local_now.date() if local_now.time() >= BUSINESS_OPEN_TIME else local_now.date() - timedelta(days=1)


def _business_day_bounds(business_date: date) -> tuple[datetime, datetime]:
    local_start = datetime.combine(business_date, BUSINESS_OPEN_TIME, BUSINESS_TIMEZONE)
    local_end = datetime.combine(business_date + timedelta(days=1), AUTOMATIC_CUTOFF_TIME, BUSINESS_TIMEZONE)
    return local_start.astimezone(timezone.utc).replace(tzinfo=None), local_end.astimezone(timezone.utc).replace(tzinfo=None)


def _auto_close_if_due(db: Session, branch_id: int, business_date: date) -> DayClosure | None:
    existing = db.query(DayClosure).filter(DayClosure.branch_id == branch_id, DayClosure.business_date == business_date).first()
    if existing:
        return existing
    cutoff_local = datetime.combine(business_date + timedelta(days=1), AUTOMATIC_CUTOFF_TIME, BUSINESS_TIMEZONE)
    if datetime.now(BUSINESS_TIMEZONE) < cutoff_local:
        return None
    closure = DayClosure(
        branch_id=branch_id,
        business_date=business_date,
        closed_by_id=None,
        closed_at=cutoff_local.astimezone(timezone.utc).replace(tzinfo=None),
    )
    db.add(closure)
    db.commit()
    db.refresh(closure)
    return closure


def _ensure_business_day_open(db: Session, branch_id: int) -> None:
    business_date = _current_business_date()
    closure = _auto_close_if_due(db, branch_id, business_date)
    if closure:
        raise HTTPException(status_code=409, detail="This branch's business day has already been closed. Payments will reopen at 8:30 AM for the next business day.")


@router.get("/pos/context")
def get_walk_in_pos_context(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
    return {
        "staff_name": current_user.full_name,
        "job_title": current_user.job_title or "Salon Staff",
        "branch_id": current_user.branch_id,
        "branch_name": branch.name if branch else "Assigned Branch",
    }


@router.get("/pos/services")
def list_walk_in_services(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    services = (
        db.query(Service)
        .filter(Service.is_active.is_(True), Service.branches.any(id=current_user.branch_id))
        .order_by(Service.name)
        .all()
    )
    return [{"id": item.id, "name": item.name, "price": item.price, "duration_minutes": item.duration_minutes, "image": item.image_url} for item in services]


@router.get("/pos/staff")
def list_walk_in_service_providers(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    staff = db.query(User).filter(
        User.role == "staff",
        User.branch_id == current_user.branch_id,
        User.is_active.is_(True),
        User.job_title.isnot(None),
    ).order_by(User.full_name).all()
    active_customer_counts = {
        provider_id: count
        for provider_id, count in db.query(BookingServiceItem.service_provider_id, func.count(BookingServiceItem.id))
        .join(Booking, Booking.id == BookingServiceItem.booking_id)
        .filter(
            Booking.branch_id == current_user.branch_id,
            Booking.status.in_(["pending", "confirmed"]),
            BookingServiceItem.service_provider_id.isnot(None),
        ).group_by(BookingServiceItem.service_provider_id).all()
    }
    for provider_id, count in db.query(Booking.service_provider_id, func.count(Booking.id)).filter(
        Booking.branch_id == current_user.branch_id,
        Booking.status.in_(["pending", "confirmed"]),
        Booking.service_provider_id.isnot(None),
        ~Booking.service_items.any(),
    ).group_by(Booking.service_provider_id).all():
        active_customer_counts[provider_id] = active_customer_counts.get(provider_id, 0) + count
    return [{"id": item.id, "full_name": item.full_name, "job_title": item.job_title or "Salon Specialist", "active_customer_count": int(active_customer_counts.get(item.id, 0)), "is_busy": active_customer_counts.get(item.id, 0) > 0} for item in staff]


def _serialize_walk_in_booking(booking: Booking) -> dict:
    items = booking.service_items or []
    services = [item.service for item in items] or [booking.service]
    return {
        "id": booking.id,
        "customer": {
            "id": booking.customer.id if booking.customer else None,
            "full_name": booking.customer.full_name if booking.customer else booking.guest_name or "Guest customer",
            "email": booking.customer.email if booking.customer else booking.guest_email,
            "phone_number": booking.customer.phone_number if booking.customer else booking.guest_phone,
        },
        "service": {"id": booking.service.id, "name": ", ".join(service.name for service in services), "price": sum(float(service.price) for service in services), "duration_minutes": sum(service.duration_minutes or 0 for service in services)},
        "services": [{"id": item.service.id, "booking_service_item_id": item.id, "name": item.service.name, "price": item.service.price, "duration_minutes": item.service.duration_minutes, "service_provider": {"id": item.service_provider.id, "full_name": item.service_provider.full_name} if item.service_provider else None} for item in items] or [{"id": booking.service.id, "booking_service_item_id": None, "name": booking.service.name, "price": booking.service.price, "duration_minutes": booking.service.duration_minutes, "service_provider": None}],
        "service_provider": {
            "id": booking.service_provider.id,
            "full_name": booking.service_provider.full_name,
        } if booking.service_provider else None,
        "appointment_date": booking.appointment_date,
        "created_at": booking.created_at,
        "checked_in_at": booking.checked_in_at,
        "status": booking.status,
        "notes": booking.notes,
        "updated_at": booking.updated_at,
    }


@router.get("/pos/walk-in/bookings")
def list_unpaid_walk_in_bookings(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    _cancel_online_no_shows(db, current_user.branch_id)
    paid_booking_ids = db.query(Transaction.booking_id)
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.service_provider))
        .filter(
            Booking.branch_id == current_user.branch_id,
            Booking.notes.like("Walk-in booking%"),
            Booking.status.in_(["confirmed", "treatment_done"]),
            ~Booking.id.in_(paid_booking_ids),
        )
        .order_by(Booking.created_at.asc(), Booking.id.asc())
        .all()
    )
    return [_serialize_walk_in_booking(booking) for booking in bookings]


def _cancel_online_no_shows(db: Session, branch_id: int) -> None:
    """Cancel unchecked bookings after 30 minutes late or when their local date has passed."""
    now_utc = datetime.now(timezone.utc)
    cutoff = (now_utc - timedelta(minutes=30)).replace(tzinfo=None)
    today_start = datetime.combine(datetime.now(BUSINESS_TIMEZONE).date(), time.min, BUSINESS_TIMEZONE)
    today_start_utc = today_start.astimezone(timezone.utc).replace(tzinfo=None)
    overdue = db.query(Booking).filter(
        Booking.branch_id == branch_id,
        Booking.status.in_(["pending", "confirmed"]),
        or_(
            and_(
                or_(Booking.notes.is_(None), ~Booking.notes.like("Walk-in booking%")),
                Booking.appointment_date <= cutoff,
            ),
            Booking.appointment_date < today_start_utc,
        ),
        Booking.checked_in_at.is_(None),
    ).all()
    for booking in overdue:
        # SQLite drops timezone info when loading DateTime(timezone=True) values.
        # Treat those stored values as UTC, consistent with booking normalization.
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


@router.post("/pos/walk-in/bookings", status_code=status.HTTP_201_CREATED)
def create_walk_in_booking(
    payload: WalkInBookingRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    requested_service_ids = list(dict.fromkeys(payload.service_ids or [payload.service_id]))
    selected_services = db.query(Service).filter(
        Service.id.in_(requested_service_ids),
        Service.is_active.is_(True),
        Service.branches.any(id=current_user.branch_id),
    ).all()
    service_map = {service.id: service for service in selected_services}
    ordered_services = [service_map[service_id] for service_id in requested_service_ids if service_id in service_map]
    if not ordered_services or len(ordered_services) != len(requested_service_ids):
        raise HTTPException(status_code=404, detail="One or more services are not available at your branch.")
    provider_map = {}
    for service in ordered_services:
        provider_id = payload.service_provider_ids.get(service.id, payload.service_provider_id)
        provider = db.query(User).filter(User.id == provider_id, User.role == "staff", User.branch_id == current_user.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).first()
        if not provider:
            raise HTTPException(status_code=404, detail=f"Select a valid provider for {service.name}.")
        provider_map[service.id] = provider
    service = ordered_services[0]
    provider = provider_map[service.id]

    clean_phone = payload.phone_number.strip()
    customer = db.query(User).filter(User.role == "customer", User.phone_number == clean_phone).first()
    if customer is None:
        customer = User(
            full_name=payload.customer_name,
            email=f"walkin-{uuid4().hex}@happyskinsalon.local",
            phone_number=clean_phone,
            role="customer",
            email_verified=False,
            password_hash=None,
        )
        db.add(customer)
        db.flush()
    else:
        customer.full_name = payload.customer_name

    booking = Booking(
        customer_id=customer.id,
        branch_id=current_user.branch_id,
        service_id=service.id,
        service_provider_id=provider.id,
        appointment_date=datetime.now(),
        status="confirmed",
        notes=f"Walk-in booking. {(payload.notes or '').strip()}".strip(),
    )
    db.add(booking)
    db.flush()
    for selected_service in ordered_services:
        db.add(BookingServiceItem(booking_id=booking.id, service_id=selected_service.id, service_provider_id=provider_map[selected_service.id].id))
    db.commit()
    booking = db.query(Booking).options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.service_provider)).filter(Booking.id == booking.id).one()
    return _serialize_walk_in_booking(booking)


@router.patch("/pos/walk-in/bookings/{booking_id}/treatment-done")
def mark_walk_in_treatment_done(
    booking_id: int,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.branch_id == current_user.branch_id,
        Booking.notes.like("Walk-in booking%"),
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Walk-in booking not found.")
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail="Only active treatments can be marked done.")
    booking.status = "treatment_done"
    db.commit()
    return {"id": booking.id, "status": booking.status}


@router.get("/online-bookings")
def list_online_bookings(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    _cancel_online_no_shows(db, current_user.branch_id)
    paid_booking_ids = db.query(Transaction.booking_id)
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.service_provider))
        .filter(
            Booking.branch_id == current_user.branch_id,
            or_(Booking.notes.is_(None), ~Booking.notes.like("Walk-in booking%")),
            Booking.status.in_(["pending", "confirmed", "treatment_done"]),
            ~Booking.id.in_(paid_booking_ids),
        )
        .order_by(Booking.created_at.asc(), Booking.id.asc())
        .all()
    )
    return [_serialize_walk_in_booking(booking) for booking in bookings]


@router.get("/cancelled-bookings")
def list_cancelled_bookings(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    _cancel_online_no_shows(db, current_user.branch_id)
    bookings = (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.service),
            joinedload(Booking.service_provider),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
            selectinload(Booking.service_items).joinedload(BookingServiceItem.service_provider),
        )
        .filter(Booking.branch_id == current_user.branch_id, Booking.status == "cancelled")
        .order_by(Booking.updated_at.desc(), Booking.id.desc())
        .all()
    )
    return [_serialize_walk_in_booking(booking) for booking in bookings]

@router.patch("/online-bookings/{booking_id}/check-in")
def check_in_online_booking(
    booking_id: int,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.branch_id == current_user.branch_id,
        or_(Booking.notes.is_(None), ~Booking.notes.like("Walk-in booking%")),
        Booking.status.in_(["pending", "confirmed"]),
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Active online booking not found.")
    if booking.checked_in_at is None:
        appointment_time = booking.appointment_date
        if appointment_time.tzinfo is not None:
            appointment_time = appointment_time.astimezone(timezone.utc).replace(tzinfo=None)
        no_show_cutoff = appointment_time + timedelta(minutes=30)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if now >= no_show_cutoff:
            booking.status = "cancelled"
            booking.notes = f"{booking.notes or ''}\nCancelled automatically: customer did not arrive within 30 minutes of the appointment time.".strip()
            db.commit()
            raise HTTPException(status_code=409, detail="This booking was cancelled after the 30-minute late-arrival window.")
    booking.checked_in_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return {"id": booking.id, "checked_in_at": booking.checked_in_at}

@router.patch("/online-bookings/{booking_id}/cancel")
def cancel_online_booking(booking_id: int, payload: BookingCancellationRequest, current_user: User = Depends(require_staff_branch), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.branch_id == current_user.branch_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if booking.status in {"cancelled", "completed", "treatment_done"}:
        raise HTTPException(status_code=400, detail="This appointment cannot be cancelled.")
    booking.status = "cancelled"
    booking.notes = f"{booking.notes or ''}\nCancellation reason: {payload.reason.strip()}\nCancelled by: {current_user.full_name}".strip()
    db.commit()
    return {"id": booking.id, "status": booking.status}


@router.patch("/online-bookings/{booking_id}/confirm")
def confirm_online_booking(
    booking_id: int,
    payload: OnlineBookingConfirmRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    _cancel_online_no_shows(db, current_user.branch_id)
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.branch_id == current_user.branch_id,
        Booking.status == "pending",
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Pending online booking not found.")
    provider = db.query(User).filter(
        User.id == payload.service_provider_id,
        User.role == "staff",
        User.branch_id == current_user.branch_id,
        User.is_active.is_(True),
        User.job_title.isnot(None),
    ).first()
    if not provider:
        raise HTTPException(status_code=400, detail="Select an active service provider from your branch.")
    for item in booking.service_items:
        assigned_id = payload.service_provider_ids.get(item.id, payload.service_provider_id)
        assigned = db.query(User).filter(User.id == assigned_id, User.role == "staff", User.branch_id == current_user.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).first()
        if not assigned:
            raise HTTPException(status_code=400, detail=f"Select an active provider for {item.service.name}.")
        item.service_provider_id = assigned.id
    booking.service_provider_id = provider.id
    booking.status = "confirmed"
    db.commit()
    return {"id": booking.id, "status": booking.status}


@router.patch("/online-bookings/{booking_id}/treatment-done")
def mark_online_treatment_done(
    booking_id: int,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.branch_id == current_user.branch_id,
        Booking.status == "confirmed",
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Confirmed online booking not found.")
    booking.status = "treatment_done"
    db.commit()
    return {"id": booking.id, "status": booking.status}


@router.post("/pos/walk-in", status_code=status.HTTP_201_CREATED)
def checkout_walk_in(
    payload: WalkInCheckoutRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    _ensure_business_day_open(db, current_user.branch_id)
    existing = db.query(Transaction).filter(Transaction.idempotency_key == payload.idempotency_key).first()
    if existing:
        raise HTTPException(status_code=409, detail="This payment request was already processed. Check transaction history before trying again.")
    service = (
        db.query(Service)
        .filter(Service.id == payload.service_id, Service.is_active.is_(True), Service.branches.any(id=current_user.branch_id))
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service is not available at your branch.")

    provider = db.query(User).filter(User.id == payload.service_provider_id, User.role == "staff", User.branch_id == current_user.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Selected service provider is not assigned to your branch.")

    base_price = float(service.price)
    charge_items = [{"reason": item.reason, "amount": float(item.amount)} for item in payload.additional_charges]
    if not charge_items and payload.additional_charge > 0:
        charge_items = [{"reason": payload.charge_reason or "Additional charge", "amount": float(payload.additional_charge)}]
    additional_charge = sum(item["amount"] for item in charge_items)
    charge_reason = "; ".join(f'{item["reason"]}: PHP {item["amount"]:,.2f}' for item in charge_items) or None
    commission_amount = round(float(payload.commission_amount or 0), 2)
    subtotal = base_price + additional_charge
    if not math.isfinite(commission_amount) or commission_amount > subtotal:
        raise HTTPException(status_code=422, detail="Customer tips cannot exceed the service and approved add-on subtotal.")
    # The customer voluntarily pays this amount on top of the full service fee.
    # It is stored separately so it never reduces salon service revenue.
    amount_due = subtotal + commission_amount
    if payload.payment_method == "cash" and payload.amount_tendered is not None and payload.amount_tendered < amount_due:
        raise HTTPException(status_code=400, detail="Cash received is less than the total amount due.")

    clean_phone = payload.phone_number.strip() if payload.phone_number else None
    customer = db.query(User).filter(User.role == "customer", User.phone_number == clean_phone).first() if clean_phone else None
    if customer is None:
        customer = User(
            full_name=payload.customer_name.strip(),
            email=f"walkin-{uuid4().hex}@happyskinsalon.local",
            phone_number=clean_phone,
            role="customer",
            email_verified=False,
            password_hash=None,
        )
        db.add(customer)
        db.flush()
    elif customer.full_name != payload.customer_name.strip():
        customer.full_name = payload.customer_name.strip()

    booking = Booking(
        customer_id=customer.id,
        branch_id=current_user.branch_id,
        service_id=service.id,
        service_provider_id=provider.id,
        appointment_date=datetime.now(),
        status="completed",
        notes=(f"Walk-in POS. {payload.notes.strip()}" if payload.notes and payload.notes.strip() else "Walk-in POS"),
    )
    db.add(booking)
    db.flush()

    transaction = Transaction(booking_id=booking.id, idempotency_key=payload.idempotency_key, staff_id=current_user.id, service_provider_id=provider.id, amount=amount_due, payment_method=payload.payment_method, additional_charge=additional_charge, charge_reason=charge_reason, commission_rate=0, commission_amount=commission_amount)
    db.add(transaction)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This payment request was already processed. Check transaction history before trying again.") from exc
    db.refresh(transaction)

    tendered = float(payload.amount_tendered) if payload.amount_tendered is not None else amount_due
    return {"transaction_id": transaction.id, "booking_id": booking.id, "customer_name": customer.full_name, "service": service.name, "service_provider": provider.full_name, "base_price": base_price, "additional_charges": charge_items, "additional_charge": additional_charge, "charge_reason": charge_reason, "subtotal": subtotal, "total": amount_due, "commission_rate": payload.commission_rate, "commission_amount": commission_amount, "amount_tendered": tendered, "change": max(0, tendered - amount_due), "payment_method": payload.payment_method}


@router.post("", status_code=status.HTTP_201_CREATED)
def encode_transaction(
    payload: TransactionCreateRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    _ensure_business_day_open(db, current_user.branch_id)
    existing_key = db.query(Transaction.id).filter(Transaction.idempotency_key == payload.idempotency_key).first()
    if existing_key:
        raise HTTPException(status_code=409, detail="This payment request was already processed. Check transaction history before trying again.")
    booking = get_booking_by_id(db, payload.booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for your branch.")

    if booking.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cannot record a transaction for a cancelled booking.",
        )

    if db.query(Transaction.id).filter(Transaction.booking_id == booking.id).first():
        raise HTTPException(
            status_code=400,
            detail="This booking already has a completed transaction.",
        )
    if booking.status != "treatment_done":
        raise HTTPException(status_code=400, detail="Mark the treatment as done before collecting payment.")

    provider_id = payload.service_provider_id or booking.service_provider_id
    provider = db.query(User).filter(User.id == provider_id, User.role == "staff", User.branch_id == current_user.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).first() if provider_id else None
    if not provider:
        raise HTTPException(status_code=400, detail="Select the staff member who performed this service.")

    charge_items = []
    for item in payload.additional_charges:
        reason = str(item.get("reason", "")).strip()
        amount = float(item.get("amount", 0) or 0)
        if not reason or amount <= 0:
            raise HTTPException(status_code=400, detail="Every additional charge needs a reason and an amount greater than zero.")
        charge_items.append({"reason": reason, "amount": amount})
    booking_services = [item.service for item in booking.service_items] or [booking.service]
    base_price = sum(float(service.price) for service in booking_services)
    additional_charge = sum(item["amount"] for item in charge_items)
    charge_reason = "; ".join(f'{item["reason"]}: PHP {item["amount"]:,.2f}' for item in charge_items) or None
    commission_amount = round(float(payload.commission_amount or 0), 2)
    # The service remains fully paid; this is a separate voluntary customer payment.
    amount_due = base_price + additional_charge + commission_amount
    if not math.isfinite(commission_amount) or commission_amount > base_price + additional_charge:
        raise HTTPException(status_code=422, detail="Customer tips cannot exceed the service and approved add-on subtotal.")
    if payload.payment_method == "cash" and payload.amount_tendered is not None and payload.amount_tendered < amount_due:
        raise HTTPException(status_code=400, detail="Cash received is less than the total amount due.")

    transaction = create_transaction(
        db,
        booking=booking,
        staff_id=current_user.id,
        amount=amount_due,
        payment_method=payload.payment_method,
        service_provider_id=provider.id,
        additional_charge=additional_charge,
        charge_reason=charge_reason,
        commission_rate=0,
        commission_amount=commission_amount,
        idempotency_key=payload.idempotency_key,
    )
    tendered = float(payload.amount_tendered) if payload.amount_tendered is not None else amount_due
    return {"id": transaction.id, "transaction_id": transaction.id, "booking_id": booking.id, "customer_name": booking.customer.full_name if booking.customer else booking.guest_name or "Guest customer", "customer_phone": booking.customer.phone_number if booking.customer else booking.guest_phone, "branch_name": booking.branch.name, "appointment_date": booking.appointment_date, "service": ", ".join(service.name for service in booking_services), "service_provider": provider.full_name, "base_price": base_price, "additional_charges": charge_items, "additional_charge": additional_charge, "commission_rate": payload.commission_rate, "commission_amount": commission_amount, "amount": amount_due, "total": amount_due, "amount_tendered": tendered, "change": max(0, tendered - amount_due), "payment_method": payload.payment_method, "created_at": transaction.created_at}


@router.get("", response_model=TransactionListResponse)
def list_branch_transactions(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be 1 or greater.")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Page size must be between 1 and 100.")

    transactions, total = get_transactions_for_branch(
        db, branch_id=current_user.branch_id, page=page, page_size=page_size
    )

    return TransactionListResponse(
        transactions=[TransactionOut.model_validate(t) for t in transactions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/day-end/close")
def close_business_day(
    report_date: date,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    if report_date != _current_business_date():
        raise HTTPException(status_code=400, detail="Only the currently open business day can be closed.")
    existing = db.query(DayClosure).options(joinedload(DayClosure.closed_by)).filter(DayClosure.branch_id == current_user.branch_id, DayClosure.business_date == report_date).first()
    if existing:
        return {"is_closed": True, "closed_at": existing.closed_at, "closed_by": existing.closed_by.full_name if existing.closed_by else "Staff"}
    closure = DayClosure(branch_id=current_user.branch_id, business_date=report_date, closed_by_id=current_user.id)
    db.add(closure)
    db.commit()
    db.refresh(closure)
    return {"is_closed": True, "closed_at": closure.closed_at, "closed_by": current_user.full_name}


@router.get("/day-end/dates")
def list_day_end_dates(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    timestamps = (
        db.query(Transaction.created_at)
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id)
        .order_by(Transaction.created_at.desc())
        .limit(5000)
        .all()
    )
    business_dates = {_current_business_date()}
    for (created_at,) in timestamps:
        if not created_at:
            continue
        timestamp = created_at.replace(tzinfo=timezone.utc) if created_at.tzinfo is None else created_at
        local_time = timestamp.astimezone(BUSINESS_TIMEZONE)
        business_date = local_time.date() if local_time.time() >= BUSINESS_OPEN_TIME else local_time.date() - timedelta(days=1)
        if business_date <= _current_business_date():
            business_dates.add(business_date)

    closures = (
        db.query(DayClosure.business_date)
        .filter(DayClosure.branch_id == current_user.branch_id, DayClosure.business_date <= _current_business_date())
        .all()
    )
    business_dates.update(day for (day,) in closures if day)
    return {"dates": [day.isoformat() for day in sorted(business_dates, reverse=True)]}


@router.get("/day-end/summary")
def get_day_end_summary(
    report_date: date,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    start, end = _business_day_bounds(report_date)
    transactions = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.booking).joinedload(Booking.customer),
            joinedload(Transaction.booking).joinedload(Booking.service),
            joinedload(Transaction.booking).joinedload(Booking.branch),
            joinedload(Transaction.service_provider),
            joinedload(Transaction.staff),
        )
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id, Transaction.created_at >= start, Transaction.created_at < end)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
    closure = db.query(DayClosure).options(joinedload(DayClosure.closed_by)).filter(DayClosure.branch_id == current_user.branch_id, DayClosure.business_date == report_date).first()
    automatic_cutoff = datetime.combine(report_date + timedelta(days=1), AUTOMATIC_CUTOFF_TIME, BUSINESS_TIMEZONE)
    automatically_closed = datetime.now(BUSINESS_TIMEZONE) >= automatic_cutoff
    automatic_cutoff_utc = automatic_cutoff.astimezone(timezone.utc).replace(tzinfo=None)
    methods = {method: 0.0 for method in ("cash", "gcash", "card", "bank_transfer")}
    provider_totals: dict[int, dict] = {}
    online_count = 0
    walk_in_count = 0
    total_collected = total_commission = 0.0
    for transaction in transactions:
        amount = float(transaction.amount or 0)
        commission = float(transaction.commission_amount or 0)
        total_collected += amount
        total_commission += commission
        methods[transaction.payment_method] = methods.get(transaction.payment_method, 0.0) + amount
        if (transaction.booking.notes or "").startswith("Walk-in"):
            walk_in_count += 1
        else:
            online_count += 1
        provider = transaction.service_provider
        provider_id = provider.id if provider else 0
        row = provider_totals.setdefault(provider_id, {"name": provider.full_name if provider else "Unassigned", "services": 0, "commission": 0.0})
        row["services"] += 1
        row["commission"] += commission
    return {
        "report_date": report_date,
        "branch_name": branch.name if branch else "Assigned Branch",
        "prepared_by": current_user.full_name,
        "generated_at": datetime.now(),
        "is_closed": bool(closure) or automatically_closed,
        "closed_at": closure.closed_at if closure else automatic_cutoff_utc if automatically_closed else None,
        "closed_by": closure.closed_by.full_name if closure and closure.closed_by else "Automatic 5:00 AM cutoff" if automatically_closed else None,
        "transaction_count": len(transactions),
        "transactions": [
            {
                "id": transaction.id,
                "booking": {
                    "id": transaction.booking.id,
                    "status": transaction.booking.status,
                    "customer": {
                        "full_name": transaction.booking.customer.full_name if transaction.booking.customer else transaction.booking.guest_name,
                        "phone_number": transaction.booking.customer.phone_number if transaction.booking.customer else transaction.booking.guest_phone,
                    },
                    "service": {"name": transaction.booking.service.name} if transaction.booking.service else None,
                    "branch": {"name": transaction.booking.branch.name} if transaction.booking.branch else None,
                },
                "staff": {"full_name": transaction.staff.full_name} if transaction.staff else None,
                "service_provider": {"full_name": transaction.service_provider.full_name} if transaction.service_provider else None,
                "amount": float(transaction.amount or 0),
                "payment_method": transaction.payment_method,
                "additional_charge": float(transaction.additional_charge or 0),
                "charge_reason": transaction.charge_reason,
                "commission_amount": float(transaction.commission_amount or 0),
                "created_at": transaction.created_at,
            }
            for transaction in transactions
        ],
        "online_count": online_count,
        "walk_in_count": walk_in_count,
        "total_collected": round(total_collected, 2),
        "salon_sales": round(total_collected - total_commission, 2),
        "commission_tips": round(total_commission, 2),
        "payment_methods": {key: round(value, 2) for key, value in methods.items()},
        "staff_performance": list(provider_totals.values()),
    }


@router.get("/reports/summary")
def get_staff_period_report(
    period: str = "daily",
    report_date: date | None = None,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    if period not in {"daily", "weekly", "monthly", "yearly"}:
        raise HTTPException(status_code=400, detail="Period must be daily, weekly, monthly, or yearly.")
    anchor = report_date or _current_business_date()
    if period == "daily":
        start_date = anchor
        end_date = anchor + timedelta(days=1)
    elif period == "weekly":
        start_date = anchor - timedelta(days=anchor.weekday())
        end_date = start_date + timedelta(days=7)
    elif period == "monthly":
        start_date = anchor.replace(day=1)
        end_date = (start_date.replace(day=28) + timedelta(days=4)).replace(day=1)
    else:
        start_date = anchor.replace(month=1, day=1)
        end_date = start_date.replace(year=start_date.year + 1)

    start, _ = _business_day_bounds(start_date)
    _, end = _business_day_bounds(end_date - timedelta(days=1))
    transactions = (
        db.query(Transaction)
        .options(joinedload(Transaction.booking).joinedload(Booking.customer), joinedload(Transaction.booking).joinedload(Booking.service), joinedload(Transaction.service_provider))
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id, Transaction.created_at >= start, Transaction.created_at < end)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
    methods = {method: 0.0 for method in ("cash", "gcash", "card", "bank_transfer")}
    providers: dict[int, dict] = {}
    online_count = walk_in_count = 0
    total_collected = total_commission = 0.0
    for transaction in transactions:
        amount = float(transaction.amount or 0)
        commission = float(transaction.commission_amount or 0)
        total_collected += amount
        total_commission += commission
        methods[transaction.payment_method] = methods.get(transaction.payment_method, 0.0) + amount
        if (transaction.booking.notes or "").startswith("Walk-in"):
            walk_in_count += 1
        else:
            online_count += 1
        provider = transaction.service_provider
        provider_id = provider.id if provider else 0
        row = providers.setdefault(provider_id, {"name": provider.full_name if provider else "Unassigned", "services": 0, "commission": 0.0, "sales": 0.0})
        row["services"] += 1
        row["commission"] += commission
        # Revenue belongs to the salon; staff commission/tips are shown separately.
        row["sales"] += max(0.0, amount - commission)

    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": (end_date - timedelta(days=1)).isoformat(),
        "branch_name": branch.name if branch else "Assigned Branch",
        "prepared_by": current_user.full_name,
        "generated_at": datetime.now(),
        "transaction_count": len(transactions),
        "online_count": online_count,
        "walk_in_count": walk_in_count,
        "total_collected": round(total_collected, 2),
        "salon_sales": round(total_collected - total_commission, 2),
        "commission_tips": round(total_commission, 2),
        "payment_methods": {key: round(value, 2) for key, value in methods.items()},
        "staff_performance": [
            {**row, "sales": round(row["sales"], 2), "commission": round(row["commission"], 2)}
            for row in providers.values()
        ],
    }
