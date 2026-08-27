from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
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
        for provider_id, count in db.query(Booking.service_provider_id, func.count(Booking.id)).filter(
            Booking.branch_id == current_user.branch_id,
            Booking.status == "confirmed",
            Booking.service_provider_id.isnot(None),
        ).group_by(Booking.service_provider_id).all()
    }
    return [{"id": item.id, "full_name": item.full_name, "job_title": item.job_title or "Salon Specialist", "active_customer_count": int(active_customer_counts.get(item.id, 0)), "is_busy": active_customer_counts.get(item.id, 0) > 0} for item in staff]


def _serialize_walk_in_booking(booking: Booking) -> dict:
    items = booking.service_items or []
    services = [item.service for item in items] or [booking.service]
    return {
        "id": booking.id,
        "customer": {"id": booking.customer.id, "full_name": booking.customer.full_name},
        "service": {"id": booking.service.id, "name": ", ".join(service.name for service in services), "price": sum(float(service.price) for service in services), "duration_minutes": sum(service.duration_minutes or 0 for service in services)},
        "services": [{"id": item.service.id, "name": item.service.name, "price": item.service.price, "duration_minutes": item.service.duration_minutes, "service_provider": {"id": item.service_provider.id, "full_name": item.service_provider.full_name} if item.service_provider else None} for item in items] or [{"id": booking.service.id, "name": booking.service.name, "price": booking.service.price, "duration_minutes": booking.service.duration_minutes, "service_provider": None}],
        "service_provider": {
            "id": booking.service_provider.id,
            "full_name": booking.service_provider.full_name,
        } if booking.service_provider else None,
        "appointment_date": booking.appointment_date,
        "status": booking.status,
        "notes": booking.notes,
    }


@router.get("/pos/walk-in/bookings")
def list_unpaid_walk_in_bookings(
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
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
        .order_by(Booking.created_at.desc())
        .all()
    )
    return [_serialize_walk_in_booking(booking) for booking in bookings]


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
        .order_by(Booking.appointment_date.asc())
        .all()
    )
    return [_serialize_walk_in_booking(booking) for booking in bookings]


@router.patch("/online-bookings/{booking_id}/confirm")
def confirm_online_booking(
    booking_id: int,
    payload: OnlineBookingConfirmRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
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

    transaction = Transaction(booking_id=booking.id, staff_id=current_user.id, service_provider_id=provider.id, amount=amount_due, payment_method=payload.payment_method, additional_charge=additional_charge, charge_reason=charge_reason, commission_rate=0, commission_amount=commission_amount)
    db.add(transaction)
    db.commit()
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
    )
    tendered = float(payload.amount_tendered) if payload.amount_tendered is not None else amount_due
    return {"id": transaction.id, "transaction_id": transaction.id, "booking_id": booking.id, "customer_name": booking.customer.full_name, "customer_phone": booking.customer.phone_number, "branch_name": booking.branch.name, "appointment_date": booking.appointment_date, "service": ", ".join(service.name for service in booking_services), "service_provider": provider.full_name, "base_price": base_price, "additional_charges": charge_items, "additional_charge": additional_charge, "commission_rate": payload.commission_rate, "commission_amount": commission_amount, "amount": amount_due, "total": amount_due, "amount_tendered": tendered, "change": max(0, tendered - amount_due), "payment_method": payload.payment_method, "created_at": transaction.created_at}


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


@router.get("/day-end/summary")
def get_day_end_summary(
    report_date: date,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    start, end = _business_day_bounds(report_date)
    transactions = (
        db.query(Transaction)
        .options(joinedload(Transaction.booking).joinedload(Booking.customer), joinedload(Transaction.booking).joinedload(Booking.service), joinedload(Transaction.service_provider))
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id, Transaction.created_at >= start, Transaction.created_at < end)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
    _auto_close_if_due(db, current_user.branch_id, report_date)
    closure = db.query(DayClosure).options(joinedload(DayClosure.closed_by)).filter(DayClosure.branch_id == current_user.branch_id, DayClosure.business_date == report_date).first()
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
        "is_closed": bool(closure),
        "closed_at": closure.closed_at if closure else None,
        "closed_by": closure.closed_by.full_name if closure and closure.closed_by else "Automatic 5:00 AM cutoff" if closure else None,
        "transaction_count": len(transactions),
        "online_count": online_count,
        "walk_in_count": walk_in_count,
        "total_collected": round(total_collected, 2),
        "salon_sales": round(total_collected - total_commission, 2),
        "commission_tips": round(total_commission, 2),
        "payment_methods": {key: round(value, 2) for key, value in methods.items()},
        "staff_performance": list(provider_totals.values()),
    }
