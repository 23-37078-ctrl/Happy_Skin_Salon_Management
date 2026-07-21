from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.booking import get_booking_by_id
from app.crud.transaction import create_transaction, get_transactions_for_branch
from app.dependencies.permissions import require_staff_branch
from app.models.user import User
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.service import Service
from app.models.transaction import Transaction
from app.schemas.transaction import (
    TransactionCreateRequest,
    TransactionListResponse,
    TransactionOut,
    WalkInCheckoutRequest,
)

router = APIRouter(prefix="/staff/transactions", tags=["Staff - Transactions"])


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
    staff = db.query(User).filter(User.role == "staff", User.branch_id == current_user.branch_id).order_by(User.full_name).all()
    return [{"id": item.id, "full_name": item.full_name, "job_title": item.job_title or "Salon Specialist"} for item in staff]


@router.post("/pos/walk-in", status_code=status.HTTP_201_CREATED)
def checkout_walk_in(
    payload: WalkInCheckoutRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    service = (
        db.query(Service)
        .filter(Service.id == payload.service_id, Service.is_active.is_(True), Service.branches.any(id=current_user.branch_id))
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service is not available at your branch.")

    provider = db.query(User).filter(User.id == payload.service_provider_id, User.role == "staff", User.branch_id == current_user.branch_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Selected service provider is not assigned to your branch.")

    base_price = float(service.price)
    additional_charge = float(payload.additional_charge or 0)
    total = base_price + additional_charge
    commission_amount = round(base_price * float(payload.commission_rate or 0) / 100, 2)
    if payload.payment_method == "cash" and payload.amount_tendered is not None and payload.amount_tendered < total:
        raise HTTPException(status_code=400, detail="Amount tendered is less than the service price.")

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

    transaction = Transaction(booking_id=booking.id, staff_id=current_user.id, service_provider_id=provider.id, amount=total, payment_method=payload.payment_method, additional_charge=additional_charge, charge_reason=payload.charge_reason.strip() if payload.charge_reason else None, commission_rate=payload.commission_rate, commission_amount=commission_amount)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    tendered = float(payload.amount_tendered) if payload.amount_tendered is not None else total
    return {"transaction_id": transaction.id, "booking_id": booking.id, "customer_name": customer.full_name, "service": service.name, "service_provider": provider.full_name, "base_price": base_price, "additional_charge": additional_charge, "total": total, "commission_rate": payload.commission_rate, "commission_amount": commission_amount, "amount_tendered": tendered, "change": max(0, tendered - total), "payment_method": payload.payment_method}


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def encode_transaction(
    payload: TransactionCreateRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, payload.booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for your branch.")

    if booking.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cannot record a transaction for a cancelled booking.",
        )

    if booking.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="This booking already has a completed transaction.",
        )

    provider_id = payload.service_provider_id or booking.service_provider_id
    provider = db.query(User).filter(User.id == provider_id, User.role == "staff", User.branch_id == current_user.branch_id).first() if provider_id else None
    if not provider:
        raise HTTPException(status_code=400, detail="Select the staff member who performed this service.")

    transaction = create_transaction(
        db,
        booking=booking,
        staff_id=current_user.id,
        amount=payload.amount,
        payment_method=payload.payment_method,
        service_provider_id=provider.id,
    )

    return TransactionOut.model_validate(transaction)


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
