from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.feedback import Feedback
from app.models.service import Service
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.booking import BookingCreateRequest, BookingOut

router = APIRouter(prefix="/customer", tags=["Customer"])


class FeedbackCreateRequest(BaseModel):
    booking_id: int
    rating: int = Field(ge=1, le=5)
    review: str | None = Field(default=None, max_length=1000)
    service_provider_id: int
    staff_rating: int = Field(ge=1, le=5)
    staff_review: str | None = Field(default=None, max_length=1000)
    branch_rating: int = Field(ge=1, le=5)
    branch_review: str | None = Field(default=None, max_length=1000)

    @field_validator("review", "staff_review", "branch_review")
    @classmethod
    def clean_review(cls, value: str | None) -> str | None:
        if value is None:
            return value
        clean_value = value.strip()
        return clean_value or None


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "email_verified": user.email_verified,
    }


def _require_customer(user: User) -> None:
    if user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access is required.",
        )


def _booking_query(db: Session):
    return db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.branch),
        joinedload(Booking.service),
        joinedload(Booking.service_provider),
        joinedload(Booking.preferred_service_provider),
    )


def _serialize_service(service: Service) -> dict:
    return {
        "id": service.id,
        "name": service.name,
        "description": service.description,
        "price": service.price,
        "duration_minutes": service.duration_minutes,
        "image": service.image_url or "/images/services/signature-facial.jpg",
        "reason": service.description or "Available for online appointment booking.",
        "branch_ids": [branch.id for branch in service.branches],
    }


def _serialize_branch(branch: Branch) -> dict:
    return {
        "id": branch.id,
        "name": branch.name,
        "address": branch.address,
        "phone": branch.phone,
        "is_active": branch.is_active,
    }


@router.get("/dashboard")
def get_customer_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)

    bookings = (
        _booking_query(db)
        .filter(Booking.customer_id == current_user.id)
        .order_by(Booking.appointment_date.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    upcoming = next(
        (
            booking
            for booking in sorted(bookings, key=lambda item: item.appointment_date)
            if booking.status in {"pending", "confirmed"} and booking.appointment_date >= now
        ),
        None,
    )
    completed = [booking for booking in bookings if booking.status == "completed"]
    services = db.query(Service).filter(Service.is_active.is_(True)).limit(6).all()

    favorite_branch = None
    if bookings:
        branch_counts: dict[int, int] = {}
        for booking in bookings:
            branch_counts[booking.branch_id] = branch_counts.get(booking.branch_id, 0) + 1
        favorite_branch_id = max(branch_counts, key=branch_counts.get)
        favorite_branch = db.query(Branch).filter(Branch.id == favorite_branch_id).first()

    return {
        "user": _serialize_user(current_user),
        "upcoming_booking": BookingOut.model_validate(upcoming) if upcoming else None,
        "upcoming_bookings_count": len(
            [b for b in bookings if b.status in {"pending", "confirmed"} and b.appointment_date >= now]
        ),
        "total_visits": len(completed),
        "loyalty_points": len(completed) * 10,
        "recommended_services": [_serialize_service(service) for service in services],
        "notifications": [
            {
                "id": "booking-ready",
                "type": "info",
                "message": "You can book appointments online and track status from this portal.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "is_read": False,
            }
        ],
        "promotions": [],
        "favorite_branch": _serialize_branch(favorite_branch) if favorite_branch else None,
        "recent_activity": [
            {
                "id": f"booking-{booking.id}",
                "type": booking.status,
                "description": f"{booking.service.name} at {booking.branch.name} is {booking.status}.",
                "timestamp": booking.updated_at or booking.created_at,
            }
            for booking in bookings[:5]
        ],
    }


@router.get("/branches")
def list_customer_branches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    branches = (
        db.query(Branch)
        .options(selectinload(Branch.services))
        .filter(Branch.is_active.is_(True))
        .order_by(Branch.name.asc())
        .all()
    )
    return [
        {
            **_serialize_branch(branch),
            "services": [_serialize_service(service) for service in branch.services if service.is_active],
        }
        for branch in branches
    ]


@router.get("/services")
def list_customer_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    services = (
        db.query(Service)
        .options(selectinload(Service.branches))
        .filter(Service.is_active.is_(True))
        .order_by(Service.name.asc())
        .all()
    )
    return [_serialize_service(service) for service in services]


@router.get("/services/featured")
def get_featured_customer_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    services = db.query(Service).filter(Service.is_active.is_(True)).limit(6).all()
    return [_serialize_service(service) for service in services]


@router.get("/branches/{branch_id}/providers")
def list_customer_branch_providers(
    branch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return only the public fields needed to request a branch specialist."""
    _require_customer(current_user)
    branch_exists = db.query(Branch.id).filter(
        Branch.id == branch_id,
        Branch.is_active.is_(True),
    ).first()
    if not branch_exists:
        raise HTTPException(status_code=404, detail="Selected branch is not available.")

    providers = db.query(User).filter(
        User.role == "staff",
        User.branch_id == branch_id,
        User.job_title.isnot(None),
    ).order_by(User.full_name.asc()).all()
    return [
        {"id": provider.id, "full_name": provider.full_name, "job_title": provider.job_title}
        for provider in providers
    ]


@router.post("/appointments", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_customer_appointment(
    payload: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)

    branch = db.query(Branch).filter(Branch.id == payload.branch_id, Branch.is_active.is_(True)).first()
    service = (
        db.query(Service)
        .join(Service.branches)
        .filter(
            Service.id == payload.service_id,
            Service.is_active.is_(True),
            Branch.id == payload.branch_id,
        )
        .first()
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Selected branch is not available.")
    if not service:
        raise HTTPException(status_code=404, detail="Selected service is not offered at this branch.")

    preferred_provider = None
    if payload.preferred_service_provider_id is not None:
        preferred_provider = db.query(User).filter(
            User.id == payload.preferred_service_provider_id,
            User.role == "staff",
            User.branch_id == payload.branch_id,
            User.job_title.isnot(None),
        ).first()
        if not preferred_provider:
            raise HTTPException(
                status_code=400,
                detail="The requested specialist is not available at the selected branch.",
            )

    appointment_date = payload.appointment_date
    now = datetime.now(appointment_date.tzinfo) if appointment_date.tzinfo else datetime.now()
    if appointment_date <= now:
        raise HTTPException(status_code=400, detail="Please choose a future appointment date and time.")

    booking = Booking(
        customer_id=current_user.id,
        branch_id=payload.branch_id,
        service_id=payload.service_id,
        appointment_date=payload.appointment_date,
        preferred_service_provider_id=preferred_provider.id if preferred_provider else None,
        notes=payload.notes,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return BookingOut.model_validate(
        _booking_query(db).filter(Booking.id == booking.id).first()
    )


@router.get("/appointments")
def list_customer_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    bookings = (
        _booking_query(db)
        .filter(Booking.customer_id == current_user.id)
        .order_by(Booking.appointment_date.desc())
        .all()
    )
    results = []
    for booking in bookings:
        item = BookingOut.model_validate(booking).model_dump()
        transaction = db.query(Transaction).filter(Transaction.booking_id == booking.id).order_by(Transaction.created_at.desc()).first()
        provider = transaction.service_provider if transaction and transaction.service_provider else booking.service_provider
        branch_staff = db.query(User).filter(User.role == "staff", User.branch_id == booking.branch_id, User.job_title.isnot(None)).order_by(User.full_name).all()
        item["service_provider"] = {"id": provider.id, "full_name": provider.full_name, "job_title": provider.job_title or "Salon Specialist"} if provider else None
        item["available_providers"] = [{"id": staff.id, "full_name": staff.full_name, "job_title": staff.job_title or "Salon Specialist"} for staff in branch_staff]
        if transaction:
            item["receipt"] = {
                "transaction_id": transaction.id,
                "amount": transaction.amount,
                "payment_method": transaction.payment_method,
                "additional_charge": transaction.additional_charge,
                "additional_charges": transaction.charge_reason,
                "commission_amount": transaction.commission_amount,
                "service_provider": provider.full_name if provider else None,
                "created_at": transaction.created_at,
            }
        else:
            item["receipt"] = None
        results.append(item)
    return results


@router.patch("/appointments/{appointment_id}/cancel", response_model=BookingOut)
def cancel_customer_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)

    booking = (
        _booking_query(db)
        .filter(Booking.id == appointment_id, Booking.customer_id == current_user.id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Completed appointments cannot be cancelled.")

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return BookingOut.model_validate(booking)


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
def submit_customer_feedback(
    payload: FeedbackCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)

    booking = (
        _booking_query(db)
        .filter(
            Booking.id == payload.booking_id,
            Booking.customer_id == current_user.id,
            Booking.status == "completed",
        )
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=400,
            detail="Feedback can only be submitted for your completed appointments.",
        )

    assigned_provider_id = booking.service_provider_id
    if assigned_provider_id and payload.service_provider_id != assigned_provider_id:
        raise HTTPException(status_code=400, detail="The staff rating must be for the assigned service provider.")

    provider = db.query(User).filter(User.id == payload.service_provider_id, User.role == "staff", User.branch_id == booking.branch_id).first()
    if not provider:
        raise HTTPException(status_code=400, detail="Selected staff member is not assigned to this branch.")

    existing = db.query(Feedback).filter(Feedback.booking_id == booking.id).first()
    if existing:
        existing.rating = payload.rating
        existing.review = payload.review
        existing.service_provider_id = provider.id
        existing.staff_rating = payload.staff_rating
        existing.staff_review = payload.staff_review
        existing.branch_rating = payload.branch_rating
        existing.branch_review = payload.branch_review
        feedback = existing
    else:
        feedback = Feedback(
            booking_id=booking.id,
            customer_id=current_user.id,
            rating=payload.rating,
            review=payload.review,
            service_provider_id=provider.id,
            staff_rating=payload.staff_rating,
            staff_review=payload.staff_review,
            branch_rating=payload.branch_rating,
            branch_review=payload.branch_review,
        )
        db.add(feedback)

    db.commit()
    db.refresh(feedback)

    return {
        "id": feedback.id,
        "booking_id": feedback.booking_id,
        "rating": feedback.rating,
        "review": feedback.review,
        "service_provider_id": feedback.service_provider_id,
        "staff_rating": feedback.staff_rating,
        "staff_review": feedback.staff_review,
        "branch_rating": feedback.branch_rating,
        "branch_review": feedback.branch_review,
        "created_at": feedback.created_at,
    }


@router.patch("/notifications/{notification_id}/read")
def mark_customer_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    _require_customer(current_user)

    return {
        "message": "Notification marked as read.",
        "notification_id": notification_id,
        "is_read": True,
    }
