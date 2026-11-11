from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import logging
import hashlib
import mimetypes
import os
import secrets
import re
from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy import update as sql_update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.core.config import BACKEND_DIR, settings
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.models.booking import Booking, BookingServiceItem
from app.models.branch import Branch
from app.models.feedback import Feedback
from app.models.service import Service
from app.models.user import User
from app.models.transaction import Transaction
from app.models.booking_payment import BookingPayment
from app.models.booking_payment_attempt import BookingPaymentAttempt
from app.models.gcash_payment_submission import GCashPaymentSubmission
from app.models.promotion import Promotion
from app.models.booking_phone_verification import BookingPhoneVerification
from app.models.customer_support import CustomerProfileChangeRequest
from app.models.customer_notification import CustomerNotificationRead
from app.schemas.booking import BookingCreateRequest, BookingOut, GuestBookingCreateRequest
from app.services.sms_service import normalize_phone_number, send_booking_confirmation_sms, send_verification_sms
from app.services.booking_lifecycle_service import cancel_overdue_bookings
from app.services.booking_scheduling import (
    BUSINESS_TIMEZONE as SCHEDULING_TIMEZONE,
    OPENING_TIME as SCHEDULING_OPENING_TIME,
    CLOSING_TIME as SCHEDULING_CLOSING_TIME,
    LAST_START_TIME,
    SLOT_INTERVAL_MINUTES,
    validate_booking_schedule,
)
from app.services.paypal_service import (
    PayPalApiError,
    capture_order as paypal_capture_order,
    create_order as paypal_create_order,
    get_order as paypal_get_order,
    is_paypal_configured,
    verify_webhook_signature as verify_paypal_webhook_signature,
)

router = APIRouter(prefix="/customer", tags=["Customer"])
logger = logging.getLogger(__name__)


class PayPalOrderRequest(BaseModel):
    booking_id: int
    payment_token: str | None = Field(default=None, min_length=32, max_length=100)


class PayPalCaptureRequest(BaseModel):
    order_id: str = Field(min_length=5, max_length=80)

BUSINESS_TIMEZONE = SCHEDULING_TIMEZONE
OPENING_TIME = SCHEDULING_OPENING_TIME
CLOSING_TIME = SCHEDULING_CLOSING_TIME
ACTIVE_BOOKING_STATUSES = {"pending", "confirmed"}
FACIAL_MACHINE_CAPACITY = 2
HAIR_TOOL_CAPACITY = 5
FACIAL_RESOURCE_SERVICES = {
    "basic facial", "deep cleansing facial", "acne facial", "brightening facial",
    "anti-aging facial", "hydrating facial", "signature facial", "hydrafacial",
    "diamond peel", "led light therapy", "rf facial", "rf body contouring",
    "cavitation", "hifu facial", "skin booster", "microneedling",
    "underarm whitening", "bikini whitening",
}
HAIR_TOOL_SERVICES = {
    "hair rebonding", "keratin treatment", "hair botox", "scalp treatment",
    "haircut", "hair spa", "hair treatment", "hair coloring",
}
LEMON_BOTTLE_SERVICES = {"face / chin", "arms", "tummy", "face + arms + tummy"}


class GuestBookingPhoneOTPSendRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=7, max_length=20)


class GuestBookingPhoneOTPVerifyRequest(BaseModel):
    verification_id: str = Field(min_length=36, max_length=36)
    code: str = Field(pattern=r"^\d{6}$")


class CustomerProfilePhoneOTPVerifyRequest(GuestBookingPhoneOTPVerifyRequest):
    branch_id: int | None = Field(default=None, gt=0)


class CustomerProfilePhoneOTPSendRequest(GuestBookingPhoneOTPSendRequest):
    branch_id: int | None = Field(default=None, gt=0)


def _profile_change_branch(db: Session, branch_id: int | None = None) -> Branch:
    query = db.query(Branch).filter(Branch.is_active.is_(True))
    if branch_id:
        branch = query.filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="The selected branch is unavailable.")
        return branch
    branches = query.order_by(Branch.id.asc()).all()
    branch = next((item for item in branches if "main" in (item.name or "").lower()), None)
    if branch:
        return branch
    if branches:
        return branches[0]
    raise HTTPException(status_code=404, detail="No active branch is available to assign this request.")


def _send_booking_receipt_sms(booking: Booking, phone_number: str, full_name: str) -> bool:
    services = [item.service.name for item in booking.service_items if item.service] or [booking.service.name]
    try:
        send_booking_confirmation_sms(
            phone_number,
            full_name,
            booking.id,
            booking.branch.name,
            ", ".join(services),
            booking.appointment_date,
        )
        return True
    except Exception as exc:
        logger.warning("Booking confirmation SMS failed for booking %s (%s).", booking.id, type(exc).__name__)
        return False


def _validated_guest_phone_challenge(db: Session, verification_id: str, phone_number: str) -> BookingPhoneVerification:
    challenge = db.query(BookingPhoneVerification).filter(
        BookingPhoneVerification.id == verification_id,
        BookingPhoneVerification.phone_number == phone_number,
    ).with_for_update().first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not challenge or not challenge.verified_at or challenge.consumed_at or challenge.expires_at <= now:
        raise HTTPException(status_code=400, detail="Verify this mobile number by SMS before submitting the guest booking.")
    return challenge


@router.get("/profile")
def get_customer_profile(current_user: User = Depends(get_current_user)):
    _require_customer(current_user)
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "email_verified": current_user.email_verified,
        "phone_number": current_user.phone_number,
        "phone_verified": current_user.phone_verified,
        "profile_image_url": current_user.profile_image_url,
    }


@router.post("/profile/photo")
async def upload_customer_profile_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    suffix = allowed_types.get(photo.content_type or "")
    if not suffix:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WebP image.")
    contents = await photo.read(3 * 1024 * 1024 + 1)
    if not contents or len(contents) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Profile photos must be 3 MB or smaller.")
    upload_dir = BACKEND_DIR / "uploads" / "customers"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}-{uuid4().hex}{suffix}"
    (upload_dir / filename).write_bytes(contents)
    current_user.profile_image_url = f"/uploads/customers/{filename}"
    db.commit()
    return {"profile_image_url": current_user.profile_image_url}


@router.post("/profile/phone/send-otp")
def send_customer_profile_phone_otp(
    payload: CustomerProfilePhoneOTPSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    branch = _profile_change_branch(db, payload.branch_id)
    pending_request = db.query(CustomerProfileChangeRequest).filter(
        CustomerProfileChangeRequest.customer_id == current_user.id,
        CustomerProfileChangeRequest.field == "phone_number",
        CustomerProfileChangeRequest.status == "pending",
    ).first()
    if pending_request:
        raise HTTPException(status_code=409, detail="You already have a phone number change request waiting for manager review.")
    try:
        phone_number = normalize_phone_number(payload.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if current_user.phone_number:
        try:
            current_phone = normalize_phone_number(current_user.phone_number)
        except ValueError:
            current_phone = ""
        if current_user.phone_verified and current_phone == phone_number:
            raise HTTPException(status_code=409, detail="This number is already saved and verified on your account.")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    recent = db.query(BookingPhoneVerification).filter(
        BookingPhoneVerification.phone_number == phone_number,
        BookingPhoneVerification.started_at >= now - timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS),
    ).order_by(BookingPhoneVerification.started_at.desc()).first()
    if recent:
        raise HTTPException(status_code=429, detail="Please wait before requesting another SMS code.")
    verification_id = str(uuid4())
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = BookingPhoneVerification(
        id=verification_id,
        phone_number=phone_number,
        code=code,
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        attempts=0,
        started_at=now,
    )
    db.add(challenge)
    db.commit()
    try:
        send_verification_sms(phone_number, current_user.full_name, code)
    except Exception as exc:
        logger.warning("Customer profile phone OTP delivery failed (%s).", type(exc).__name__)
        db.delete(challenge)
        db.commit()
        raise HTTPException(status_code=503, detail="We couldn't send the SMS code. Check the mobile number and try again.") from exc
    return {"verification_id": verification_id, "branch_id": branch.id, "expires_in_minutes": settings.OTP_EXPIRE_MINUTES}


@router.post("/profile/phone/verify")
def verify_customer_profile_phone(
    payload: CustomerProfilePhoneOTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    challenge = db.query(BookingPhoneVerification).filter(
        BookingPhoneVerification.id == payload.verification_id,
    ).with_for_update().first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not challenge or challenge.consumed_at or challenge.expires_at <= now:
        raise HTTPException(status_code=400, detail="This SMS code expired. Request a new one.")
    branch = _profile_change_branch(db, payload.branch_id)
    if current_user.phone_verified and current_user.phone_number:
        try:
            current_phone = normalize_phone_number(current_user.phone_number)
        except ValueError:
            current_phone = ""
        if current_phone == challenge.phone_number:
            raise HTTPException(status_code=409, detail="This number is already saved and verified on your account.")
    if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new SMS code.")
    if not secrets.compare_digest(challenge.code, payload.code):
        challenge.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="The SMS code is incorrect.")
    pending_request = db.query(CustomerProfileChangeRequest).filter(
        CustomerProfileChangeRequest.customer_id == current_user.id,
        CustomerProfileChangeRequest.field == "phone_number",
        CustomerProfileChangeRequest.status == "pending",
    ).first()
    if pending_request:
        raise HTTPException(status_code=409, detail="You already have a phone number change request waiting for manager review.")
    challenge.verified_at = now
    challenge.consumed_at = now
    change_request = CustomerProfileChangeRequest(
        customer_id=current_user.id,
        branch_id=branch.id,
        field="phone_number",
        current_value=current_user.phone_number,
        requested_value=challenge.phone_number,
        status="pending",
    )
    db.add(change_request)
    db.commit()
    return {
        "id": change_request.id,
        "field": change_request.field,
        "current_value": change_request.current_value,
        "requested_value": change_request.requested_value,
        "status": change_request.status,
        "branch_id": change_request.branch_id,
        "created_at": change_request.created_at,
    }


@router.post("/guest/phone-verification/send")
def send_guest_booking_phone_otp(payload: GuestBookingPhoneOTPSendRequest, db: Session = Depends(get_db)):
    try:
        phone_number = normalize_phone_number(payload.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    cancel_overdue_bookings(db)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.query(BookingPhoneVerification).filter(BookingPhoneVerification.expires_at <= now).delete(synchronize_session=False)
    recent = db.query(BookingPhoneVerification).filter(
        BookingPhoneVerification.phone_number == phone_number,
        BookingPhoneVerification.started_at >= now - timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS),
    ).order_by(BookingPhoneVerification.started_at.desc()).first()
    if recent:
        raise HTTPException(status_code=429, detail="Please wait before requesting another SMS code.")

    verification_id = str(uuid4())
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = BookingPhoneVerification(
        id=verification_id,
        phone_number=phone_number,
        code=code,
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        attempts=0,
        started_at=now,
    )
    db.add(challenge)
    db.commit()
    try:
        send_verification_sms(phone_number, payload.full_name.strip(), code)
    except Exception as exc:
        logger.warning("Guest booking OTP delivery failed (%s).", type(exc).__name__)
        db.delete(challenge)
        db.commit()
        raise HTTPException(status_code=503, detail="We couldn't send the SMS code. Check the mobile number and try again.") from exc
    return {"verification_id": verification_id, "expires_in_minutes": settings.OTP_EXPIRE_MINUTES}


@router.post("/guest/phone-verification/verify")
def verify_guest_booking_phone_otp(payload: GuestBookingPhoneOTPVerifyRequest, db: Session = Depends(get_db)):
    challenge = db.query(BookingPhoneVerification).filter(
        BookingPhoneVerification.id == payload.verification_id,
    ).with_for_update().first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not challenge or challenge.consumed_at or challenge.expires_at <= now:
        raise HTTPException(status_code=400, detail="This SMS code expired. Request a new one.")
    if challenge.verified_at:
        return {"verified": True, "verification_id": challenge.id}
    if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new SMS code.")
    if not secrets.compare_digest(challenge.code, payload.code):
        challenge.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="The SMS code is incorrect.")
    challenge.verified_at = now
    db.commit()
    return {"verified": True, "verification_id": challenge.id}


def _slot_capacity(db: Session, branch_id: int) -> int:
    return db.query(User).filter(
        User.role == "staff",
        User.branch_id == branch_id,
        User.is_active.is_(True),
        User.job_title.isnot(None),
    ).count()


def _branch_day_bookings(db: Session, branch_id: int, appointment_date: datetime):
    local_date = appointment_date.astimezone(BUSINESS_TIMEZONE).date()
    day_start = datetime.combine(local_date, time.min, BUSINESS_TIMEZONE).astimezone(timezone.utc)
    day_end = day_start + timedelta(days=1)
    return db.query(Booking).options(
        joinedload(Booking.service),
        selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
    ).filter(
        Booking.branch_id == branch_id,
        Booking.appointment_date >= day_start,
        Booking.appointment_date < day_end,
        Booking.status.in_(ACTIVE_BOOKING_STATUSES),
    ).all()


def _service_resource_types(service: Service) -> set[str]:
    name = " ".join((service.name or "").casefold().split())
    resources = set()
    if name in FACIAL_RESOURCE_SERVICES or name in LEMON_BOTTLE_SERVICES:
        resources.add("face_machine")
    if name in HAIR_TOOL_SERVICES:
        resources.add("hair_tool")
    if name in LEMON_BOTTLE_SERVICES:
        resources.add("nurse")
    return resources


def _booking_services(booking: Booking) -> list[Service]:
    return [item.service for item in booking.service_items if item.service] or ([booking.service] if booking.service else [])


def _branch_nurse_capacity(db: Session, branch_id: int) -> int:
    return db.query(User).filter(
        User.role == "staff",
        User.branch_id == branch_id,
        User.is_active.is_(True),
        User.job_title.ilike("%nurse%"),
    ).count()


def _slot_has_resource_capacity(
    db: Session,
    branch_id: int,
    appointment_date: datetime,
    requested_services: list[Service],
    bookings: list[Booking] | None = None,
    exclude_booking_id: int | None = None,
    nurse_capacity: int | None = None,
) -> bool:
    if bookings is None:
        bookings = _branch_day_bookings(db, branch_id, appointment_date)
    if nurse_capacity is None:
        nurse_capacity = _branch_nurse_capacity(db, branch_id)

    occupied: dict[str, list[tuple[datetime, datetime]]] = {
        "face_machine": [], "hair_tool": [], "nurse": [],
    }
    for booking in bookings:
        if booking.id == exclude_booking_id:
            continue
        cursor = booking.appointment_date
        if cursor.tzinfo is None:
            cursor = cursor.replace(tzinfo=timezone.utc)
        else:
            cursor = cursor.astimezone(timezone.utc)
        for service in _booking_services(booking):
            end = cursor + timedelta(minutes=service.duration_minutes or 0)
            for resource in _service_resource_types(service):
                occupied[resource].append((cursor, end))
            cursor = end

    capacities = {
        "face_machine": FACIAL_MACHINE_CAPACITY,
        "hair_tool": HAIR_TOOL_CAPACITY,
        "nurse": nurse_capacity,
    }
    cursor = appointment_date.astimezone(timezone.utc)
    for service in requested_services:
        end = cursor + timedelta(minutes=service.duration_minutes or 0)
        for resource in _service_resource_types(service):
            capacity = capacities[resource]
            if capacity < 1:
                return False
            concurrent = sum(start < end and occupied_end > cursor for start, occupied_end in occupied[resource])
            if concurrent >= capacity:
                return False
        cursor = end
    return True


def _reject_overlapping_customer_booking(
    db: Session,
    appointment_date: datetime,
    duration_minutes: int,
    *,
    customer_id: int | None = None,
    guest_phone: str | None = None,
    guest_email: str | None = None,
    allow_exact_duplicate: bool = False,
    requested_service_ids: set[int] | None = None,
) -> None:
    """Prevent the same customer/contact from holding overlapping active bookings."""
    local_start = appointment_date.astimezone(BUSINESS_TIMEZONE).replace(tzinfo=None) if appointment_date.tzinfo else appointment_date
    day_start = datetime.combine(local_start.date(), time.min)
    query = db.query(Booking).options(
        joinedload(Booking.service),
        selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
    ).filter(
        Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        Booking.appointment_date >= day_start,
        Booking.appointment_date < day_start + timedelta(days=1),
    )
    identities = []
    if customer_id is not None:
        identities.append(Booking.customer_id == customer_id)
    if guest_phone:
        identities.append(Booking.guest_phone == guest_phone)
    if guest_email:
        identities.append(func.lower(Booking.guest_email) == guest_email.lower())
    if not identities:
        return

    requested_end = local_start + timedelta(minutes=max(duration_minutes, 1))
    for existing in query.filter(or_(*identities)).all():
        existing_start = existing.appointment_date
        if existing_start.tzinfo:
            existing_start = existing_start.astimezone(BUSINESS_TIMEZONE).replace(tzinfo=None)
        else:
            existing_start = existing_start.replace(tzinfo=timezone.utc).astimezone(BUSINESS_TIMEZONE).replace(tzinfo=None)
        existing_services = _booking_services(existing)
        existing_duration = sum(item.duration_minutes or 0 for item in existing_services)
        if not existing_duration:
            existing_duration = existing.service.duration_minutes if existing.service else 0
        existing_end = existing_start + timedelta(minutes=max(existing_duration, 1))
        if local_start < existing_end and existing_start < requested_end:
            existing_service_ids = {item.id for item in existing_services}
            if (
                allow_exact_duplicate
                and existing_start == local_start
                and requested_service_ids is not None
                and existing_service_ids == requested_service_ids
            ):
                continue
            raise HTTPException(
                status_code=409,
                detail="DOUBLE_BOOKING: You already have an active appointment at this time. Choose a different time or cancel the existing booking first.",
            )


def _lock_booking_branch(db: Session, branch_id: int) -> Branch | None:
    """Serialize booking writes per branch before checking and claiming capacity."""
    query = db.query(Branch).filter(Branch.id == branch_id, Branch.is_active.is_(True))
    dialect_name = db.get_bind().dialect.name
    if dialect_name == "sqlite":
        # SQLite has no row-level FOR UPDATE lock. Take its write lock before
        # reading availability so another booking transaction cannot race us.
        db.execute(sql_update(Booking).values(id=Booking.id))
        query = query.populate_existing()
    else:
        query = query.with_for_update()
    return query.first()


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
        "phone_number": user.phone_number,
        "phone_verified": user.phone_verified,
        "profile_image_url": user.profile_image_url,
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
        selectinload(Booking.service_items).joinedload(BookingServiceItem.service),
        selectinload(Booking.service_items).joinedload(BookingServiceItem.service_provider),
    )


def _start_online_booking_payment(db: Session, booking: Booking, services: list[Service], *, guest: bool = False) -> BookingOut:
    """Create a pending full-payment record; PayPal orders are created on demand."""
    token = secrets.token_urlsafe(32) if guest else None
    reference = f"HS-{booking.id}-{uuid4().hex[:12]}"
    total = round(sum(float(service.price) for service in services), 2)
    payment = BookingPayment(
        booking_id=booking.id,
        reference_number=reference,
        amount=total,
        provider="gcash",
        status="pending",
        guest_status_token_hash=hashlib.sha256(token.encode()).hexdigest() if token else None,
    )
    db.add(payment)
    db.commit()
    result = BookingOut.model_validate(booking)
    return result.model_copy(update={"payment_status": "pending", "payment_token": token})


@router.get("/payments/status")
def get_booking_payment_status(token: str = Query(min_length=32, max_length=100), db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    payment = db.query(BookingPayment).filter(BookingPayment.guest_status_token_hash == token_hash).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link was not found.")
    return {"booking_id": payment.booking_id, "status": payment.status, "amount": payment.amount,
            "payment_reference": payment.payment_id if payment.status == "paid" else None}


def _gcash_qr_image_path() -> Path:
    configured_path = Path(settings.GCASH_QR_IMAGE_PATH) if settings.GCASH_QR_IMAGE_PATH else None
    if configured_path and configured_path.is_file():
        return configured_path
    private_uploads = BACKEND_DIR / "private_uploads"
    for filename in ("gcash-merchant-qr.png", "gcash-merchant-qr.jpg", "gcash-merchant-qr.jpeg"):
        candidate = private_uploads / filename
        if candidate.is_file():
            return candidate
    return private_uploads / "gcash-merchant-qr.png"


def _gcash_instructions(payment: BookingPayment) -> dict:
    qr_path = _gcash_qr_image_path()
    qr_exists = qr_path.is_file()
    return {"booking_id": payment.booking_id, "booking_reference": payment.reference_number,
            "amount": float(payment.amount), "merchant_name": settings.GCASH_MERCHANT_NAME.strip() or None,
            "qr_available": bool(qr_exists and settings.GCASH_MERCHANT_NAME.strip()),
            "qr_url": f"/api/v1/customer/payments/{payment.booking_id}/gcash/qr" if qr_exists else None,
            "status": payment.status}


@router.get("/payments/{booking_id}/gcash/instructions")
def gcash_payment_instructions(booking_id: int, payment_token: str | None = Query(default=None), current_user: User | None = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    payment, _ = _payment_for_customer(db, booking_id, current_user, payment_token)
    return _gcash_instructions(payment)


@router.get("/payments/{booking_id}/gcash/qr")
def gcash_merchant_qr(booking_id: int, payment_token: str | None = Query(default=None), current_user: User | None = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    payment, _ = _payment_for_customer(db, booking_id, current_user, payment_token)
    path = _gcash_qr_image_path()
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The merchant QR image has not been configured.")
    from fastapi.responses import FileResponse
    return FileResponse(path, media_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream", filename=path.name)


@router.post("/payments/{booking_id}/gcash/proof")
async def submit_gcash_proof(booking_id: int, reference_number: str = Form(min_length=6, max_length=80),
    proof: UploadFile = File(...), reported_paid_at: datetime | None = Form(default=None), payment_token: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    payment, booking = _payment_for_customer(db, booking_id, current_user, payment_token)
    if payment.status not in {"pending", "rejected"}:
        raise HTTPException(status_code=409, detail="This booking payment is not accepting GCash proof.")
    normalized = re.sub(r"[\s-]", "", reference_number).upper()
    if not re.fullmatch(r"[A-Z0-9]{6,80}", normalized):
        raise HTTPException(status_code=422, detail="Enter a valid GCash transaction reference.")
    if reported_paid_at is not None and reported_paid_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="Include the payment date and time with timezone.")
    data = await proof.read(settings.GCASH_PROOF_MAX_BYTES + 1)
    if len(data) > settings.GCASH_PROOF_MAX_BYTES:
        raise HTTPException(status_code=413, detail="The screenshot must be 5 MB or smaller.")
    signatures = {"png": (b"\x89PNG\r\n\x1a\n", "image/png"), "jpeg": (b"\xff\xd8\xff", "image/jpeg"),
                  "webp": (b"RIFF", "image/webp")}
    kind = next((name for name, (magic, _) in signatures.items() if data.startswith(magic)), None)
    if kind == "webp" and data[8:12] != b"WEBP": kind = None
    if not kind:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPG, or WEBP payment screenshot.")
    storage = (Path(settings.GCASH_PROOF_STORAGE_PATH) if settings.GCASH_PROOF_STORAGE_PATH else BACKEND_DIR / "private_uploads" / "gcash").resolve()
    public_uploads = (BACKEND_DIR / "uploads").resolve()
    if storage == public_uploads or public_uploads in storage.parents:
        raise HTTPException(status_code=500, detail="Private payment storage is misconfigured.")
    storage.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != "nt":
        os.chmod(storage, 0o700)
    filename = f"{uuid4().hex}.{kind}"
    file_descriptor = os.open(storage / filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(file_descriptor, "wb") as private_file:
        private_file.write(data)
    submission = GCashPaymentSubmission(booking_payment_id=payment.id, reference_number=normalized,
        reported_paid_at=reported_paid_at.astimezone(timezone.utc) if reported_paid_at else datetime.now(timezone.utc), proof_path=filename,
        proof_content_type=signatures[kind][1], amount=Decimal(str(payment.amount)), status="for_verification")
    payment.status = "for_verification"
    payment.provider = "gcash"
    for paypal_attempt in db.query(BookingPaymentAttempt).filter(
        BookingPaymentAttempt.booking_payment_id == payment.id,
        BookingPaymentAttempt.status.in_(["creating", "pending"]),
    ).with_for_update().all():
        # Switching methods prevents a browser callback from initiating a late capture.
        paypal_attempt.status = "cancelled"
    try:
        db.add(submission); db.commit()
    except Exception:
        db.rollback(); (storage / filename).unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail="This GCash reference has already been submitted.")
    return {"booking_id": booking_id, "status": "for_verification", "message": "Payment proof submitted for staff verification."}


def _payment_for_customer(db: Session, booking_id: int, current_user: User | None, token: str | None):
    payment = db.query(BookingPayment).filter(BookingPayment.booking_id == booking_id).with_for_update().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Booking payment was not found.")
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking was not found.")
    if current_user:
        _require_customer(current_user)
        if booking.customer_id != current_user.id:
            raise HTTPException(status_code=404, detail="Booking payment was not found.")
    else:
        token_hash = hashlib.sha256((token or "").encode()).hexdigest()
        if not token or not secrets.compare_digest(payment.guest_status_token_hash or "", token_hash):
            raise HTTPException(status_code=404, detail="Booking payment was not found.")
    if booking.status == "cancelled" or payment.status == "cancelled":
        raise HTTPException(status_code=409, detail="This booking has been cancelled.")
    if payment.status == "paid":
        raise HTTPException(status_code=409, detail="This booking is already paid.")
    if db.query(Transaction.id).filter(Transaction.booking_id == booking_id).first():
        raise HTTPException(status_code=409, detail="A transaction has already been recorded for this booking.")
    return payment, booking


def _paypal_amount(value) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError):
        raise HTTPException(status_code=400, detail="PayPal returned an invalid amount.")


@router.post("/payments/paypal/orders")
async def create_customer_paypal_order(payload: PayPalOrderRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await _create_paypal_order(payload, current_user, db)


@router.post("/guest/payments/paypal/orders")
async def create_guest_paypal_order(payload: PayPalOrderRequest, db: Session = Depends(get_db)):
    return await _create_paypal_order(payload, None, db)


async def _create_paypal_order(payload: PayPalOrderRequest, current_user: User | None, db: Session):
    if not is_paypal_configured():
        raise HTTPException(status_code=503, detail="PayPal Sandbox payments are not configured.")
    payment, booking = _payment_for_customer(db, payload.booking_id, current_user, payload.payment_token)
    if payment.status not in {"pending", "rejected"}:
        raise HTTPException(status_code=409, detail="This booking payment cannot be switched to PayPal in its current state.")
    payment.status = "pending"
    payment.provider = "paypal"
    attempt = db.query(BookingPaymentAttempt).filter(
        BookingPaymentAttempt.booking_payment_id == payment.id,
        BookingPaymentAttempt.status.in_(["creating", "pending"]),
    ).order_by(BookingPaymentAttempt.id.desc()).with_for_update().first()
    if attempt and attempt.paypal_order_id:
        db.commit()
        return {"order_id": attempt.paypal_order_id}
    if not attempt:
        amount = _paypal_amount(payment.amount)
        attempt = BookingPaymentAttempt(
            booking_payment_id=payment.id,
            create_request_id=uuid4().hex,
            status="creating",
            amount=amount,
            currency="PHP",
        )
        db.add(attempt)
        db.flush()
    else:
        amount = _paypal_amount(payment.amount)
    services = [item.service.name for item in booking.service_items if item.service] or [booking.service.name]
    attempt_id = attempt.id
    request_id = attempt.create_request_id
    description = ", ".join(services)
    reference = f"{payment.reference_number}-{attempt_id}"
    db.commit()
    try:
        result = await run_in_threadpool(paypal_create_order, amount=amount, reference=reference, description=description, request_id=request_id)
    except PayPalApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    attempt = db.query(BookingPaymentAttempt).filter(BookingPaymentAttempt.id == attempt_id).with_for_update().first()
    payment = db.query(BookingPayment).filter(BookingPayment.id == payment.id).first()
    booking = db.query(Booking).filter(Booking.id == booking.id).first()
    if not attempt or not payment or not booking or booking.status == "cancelled" or payment.status != "pending":
        if attempt:
            attempt.status = "cancelled"
            db.commit()
        raise HTTPException(status_code=409, detail="Booking is no longer available for payment.")
    order_id = result.get("id")
    if not order_id:
        attempt.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail="PayPal returned an invalid order response.")
    attempt.paypal_order_id = order_id
    attempt.status = "pending"
    db.commit()
    return {"order_id": order_id}


@router.post("/payments/paypal/capture")
async def capture_customer_paypal_order(payload: PayPalCaptureRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await _capture_paypal_order(payload.order_id, current_user, None, db)


@router.post("/guest/payments/paypal/capture")
async def capture_guest_paypal_order(payload: PayPalCaptureRequest, payment_token: str = Query(min_length=32, max_length=100), db: Session = Depends(get_db)):
    return await _capture_paypal_order(payload.order_id, None, payment_token, db)


async def _capture_paypal_order(order_id: str, current_user: User | None, token: str | None, db: Session):
    attempt = db.query(BookingPaymentAttempt).filter(BookingPaymentAttempt.paypal_order_id == order_id).with_for_update().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="PayPal order was not found.")
    payment = db.query(BookingPayment).filter(BookingPayment.id == attempt.booking_payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Booking payment was not found.")
    payment, booking = _payment_for_customer(db, payment.booking_id, current_user, token)
    if payment.provider != "paypal" or payment.status != "pending":
        raise HTTPException(status_code=409, detail="This PayPal attempt is no longer the active payment method.")
    if attempt.status in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail="This PayPal payment attempt is no longer active. Create a new payment attempt.")
    if not attempt.capture_request_id:
        attempt.capture_request_id = uuid4().hex
        db.commit()
    capture_error = None
    try:
        capture = await run_in_threadpool(paypal_capture_order, order_id, request_id=attempt.capture_request_id)
    except PayPalApiError as exc:
        capture_error = exc
        capture = None
    if not capture or capture.get("status") != "COMPLETED":
        try:
            capture = await run_in_threadpool(paypal_get_order, order_id)
        except PayPalApiError as exc:
            db.rollback()
            safe_error = str(capture_error) if capture_error else str(exc)
            raise HTTPException(status_code=502, detail=safe_error) from exc
    return _record_paypal_capture(db, attempt, payment, booking, capture)


def _record_paypal_capture(db: Session, attempt: BookingPaymentAttempt, payment: BookingPayment, booking: Booking, order: dict):
    if order.get("status") != "COMPLETED":
        db.rollback()
        raise HTTPException(status_code=402, detail="PayPal has not completed this payment yet.")
    units = order.get("purchase_units") or []
    captures = [capture for unit in units for capture in ((unit.get("payments") or {}).get("captures") or [])]
    captured = next((item for item in captures if item.get("status") == "COMPLETED"), None)
    if not captured:
        if any(item.get("status") in {"DENIED", "DECLINED"} for item in captures):
            attempt.status = "failed"
            db.commit()
        raise HTTPException(status_code=402, detail="PayPal has not completed this payment yet.")
    amount = (captured.get("amount") or {})
    if amount.get("currency_code") != "PHP" or _paypal_amount(amount.get("value")) != _paypal_amount(payment.amount):
        db.rollback()
        raise HTTPException(status_code=400, detail="PayPal payment amount or currency does not match the booking.")
    capture_id = captured.get("id")
    if not capture_id:
        raise HTTPException(status_code=400, detail="PayPal did not return a capture reference.")
    if payment.status == "paid":
        if payment.payment_id == capture_id:
            db.rollback()
            return {"status": "paid", "booking_id": booking.id, "capture_id": capture_id}
        db.rollback()
        logger.error("Different PayPal capture received for already-paid booking %s", booking.id)
        return {"status": "paid", "booking_id": booking.id}
    now = datetime.now(timezone.utc)
    if payment.status == "for_verification":
        # A PayPal order can settle after the customer switches to GCash. The
        # verified capture is authoritative; stale GCash proof must leave the queue.
        for submission in db.query(GCashPaymentSubmission).filter(
            GCashPaymentSubmission.booking_payment_id == payment.id,
            GCashPaymentSubmission.status == "for_verification",
        ).all():
            submission.status = "stale"
            submission.remarks = "A verified PayPal capture settled this booking before manual review."
    payment.provider = "paypal"
    payment.verified_by_id = None
    payment.verified_at = None
    payment.decision_remarks = None
    attempt.paypal_capture_id = capture_id
    attempt.status = "paid"
    attempt.paid_at = now
    payment.status = "paid"
    payment.payment_id = capture_id
    payment.payment_method = "paypal"
    payment.paid_at = now
    transaction = db.query(Transaction).filter(Transaction.booking_id == booking.id).first()
    created = transaction is None
    if created:
        db.add(Transaction(booking_id=booking.id, staff_id=None, service_provider_id=booking.service_provider_id,
                           amount=float(payment.amount), payment_method="paypal", additional_charge=0,
                           commission_rate=0, commission_amount=0, idempotency_key=f"paypal:{capture_id}"[:80]))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Payment was already recorded; refresh the booking history.")
    if created:
        phone = booking.guest_phone or (booking.customer.phone_number if booking.customer else None)
        name = booking.guest_name or (booking.customer.full_name if booking.customer else "Customer")
        if phone:
            _send_booking_receipt_sms(booking, phone, name)
    return {"status": "paid", "booking_id": booking.id, "capture_id": capture_id}


@router.get("/payments/{booking_id}/status")
def get_customer_payment_status(booking_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_customer(current_user)
    payment = db.query(BookingPayment).join(Booking).filter(BookingPayment.booking_id == booking_id, Booking.customer_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Booking payment was not found.")
    return {"booking_id": booking_id, "status": payment.status, "amount": payment.amount,
            "payment_reference": payment.payment_id if payment.status == "paid" else None}


@router.post("/payments/paypal/webhook")
async def paypal_booking_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        event = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid PayPal webhook payload.") from exc
    try:
        verified = await run_in_threadpool(verify_paypal_webhook_signature, event, dict(request.headers))
    except PayPalApiError as exc:
        raise HTTPException(status_code=502, detail="PayPal webhook verification is unavailable.") from exc
    if not verified:
        raise HTTPException(status_code=400, detail="Invalid PayPal webhook signature.")
    event_type = event.get("event_type")
    resource = event.get("resource") or {}
    related = (resource.get("supplementary_data") or {}).get("related_ids") or {}
    order_id = related.get("order_id") or resource.get("id")
    if event_type == "PAYMENT.CAPTURE.DENIED" and order_id:
        attempt = db.query(BookingPaymentAttempt).filter(BookingPaymentAttempt.paypal_order_id == order_id).with_for_update().first()
        if attempt and attempt.status == "pending":
            attempt.status = "failed"
            db.commit()
        return {"received": True, "processed": bool(attempt)}
    if event_type in {"PAYMENT.CAPTURE.COMPLETED", "CHECKOUT.ORDER.COMPLETED"} and order_id:
        attempt = db.query(BookingPaymentAttempt).filter(BookingPaymentAttempt.paypal_order_id == order_id).with_for_update().first()
        if attempt:
            payment = db.query(BookingPayment).filter(BookingPayment.id == attempt.booking_payment_id).with_for_update().first()
            booking = db.query(Booking).filter(Booking.id == payment.booking_id).with_for_update().first() if payment else None
            try:
                order = await run_in_threadpool(paypal_get_order, order_id)
                if payment and booking:
                    _record_paypal_capture(db, attempt, payment, booking, order)
            except HTTPException as exc:
                if exc.status_code in {400, 402}:
                    logger.warning("PayPal webhook did not reconcile order %s: %s", order_id, exc.detail)
                    return {"received": True, "processed": False}
                raise
    return {"received": True, "processed": True}


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
    booking_ids = [booking.id for booking in bookings]
    receipt_transactions = (
        db.query(Transaction)
        .filter(Transaction.booking_id.in_(booking_ids))
        .order_by(Transaction.created_at.desc())
        .limit(5)
        .all()
        if booking_ids
        else []
    )
    bookings_by_id = {booking.id: booking for booking in bookings}
    services = db.query(Service).filter(Service.is_active.is_(True)).limit(6).all()

    favorite_branch = None
    if bookings:
        branch_counts: dict[int, int] = {}
        for booking in bookings:
            branch_counts[booking.branch_id] = branch_counts.get(booking.branch_id, 0) + 1
        favorite_branch_id = max(branch_counts, key=branch_counts.get)
        favorite_branch = db.query(Branch).filter(Branch.id == favorite_branch_id).first()

    today = datetime.now(BUSINESS_TIMEZONE).date()
    promotions = db.query(Promotion).options(joinedload(Promotion.branch)).filter(Promotion.is_active.is_(True), Promotion.start_date <= today, Promotion.end_date >= today).order_by(Promotion.end_date.asc(), Promotion.created_at.desc()).all()
    read_notification_ids = {
        row.notification_id
        for row in db.query(CustomerNotificationRead.notification_id).filter(
            CustomerNotificationRead.customer_id == current_user.id
        ).all()
    }
    notifications = [
        {
            "id": f"receipt-{transaction.id}",
            "type": "receipt",
            "message": (
                f"Receipt #{transaction.id}: "
                f"{bookings_by_id[transaction.booking_id].service.name} paid "
                f"PHP {float(transaction.amount):,.2f}."
            ),
            "timestamp": transaction.created_at,
            "is_read": f"receipt-{transaction.id}" in read_notification_ids,
            "booking_id": transaction.booking_id,
            "receipt_id": transaction.id,
            "amount": float(transaction.amount),
        }
        for transaction in receipt_transactions
    ]
    payment_notifications = db.query(BookingPayment).filter(
        BookingPayment.booking_id.in_(booking_ids),
        BookingPayment.status.in_(["for_verification", "rejected"]),
    ).all() if booking_ids else []
    for payment in payment_notifications:
        notification_id = f"payment-{payment.id}-{payment.status}"
        if payment.status == "for_verification":
            message = f"GCash proof for booking {payment.reference_number} is waiting for staff verification. It is not approved yet."
        else:
            reason = f" Reason: {payment.decision_remarks}" if payment.decision_remarks else ""
            message = f"GCash proof for booking {payment.reference_number} was rejected. Check your booking history before submitting new proof.{reason}"
        notifications.append({
            "id": notification_id,
            "type": "system",
            "message": message,
            "timestamp": payment.updated_at or payment.created_at,
            "is_read": notification_id in read_notification_ids,
            "booking_id": payment.booking_id,
        })
    notifications.sort(key=lambda item: (
        (item["timestamp"] or datetime.min.replace(tzinfo=timezone.utc)).replace(tzinfo=timezone.utc)
        if (item["timestamp"] or datetime.min).tzinfo is None
        else item["timestamp"]
    ).timestamp(), reverse=True)

    return {
        "user": _serialize_user(current_user),
        "upcoming_booking": BookingOut.model_validate(upcoming) if upcoming else None,
        "upcoming_bookings_count": len(
            [b for b in bookings if b.status in {"pending", "confirmed"} and b.appointment_date >= now]
        ),
        "total_visits": len(completed),
        "loyalty_points": len(completed) * 10,
        "recommended_services": [_serialize_service(service) for service in services],
        "notifications": notifications,
        "promotions": [
            {"id": item.id, "title": item.title, "subtitle": item.subtitle or item.branch.name, "image": item.image_url, "branch_id": item.branch_id, "branch_name": item.branch.name, "start_date": item.start_date, "end_date": item.end_date}
            for item in promotions
        ],
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
        User.is_active.is_(True),
        User.job_title.isnot(None),
    ).order_by(User.full_name.asc()).all()
    return [
        {"id": provider.id, "full_name": provider.full_name, "job_title": provider.job_title}
        for provider in providers
    ]


def _booking_availability(
    branch_id: int,
    service_id: int,
    booking_date: date,
    service_ids: list[int],
    db: Session,
):
    requested_ids = list(dict.fromkeys(service_ids or [service_id]))
    services = db.query(Service).join(Service.branches).filter(Service.id.in_(requested_ids), Service.is_active.is_(True), Branch.id == branch_id, Branch.is_active.is_(True)).all()
    service_map = {service.id: service for service in services}
    selected_services = [service_map[service_id] for service_id in requested_ids if service_id in service_map]
    if len(selected_services) != len(requested_ids):
        raise HTTPException(status_code=404, detail="One or more selected services are not offered at this branch.")
    cursor = datetime.combine(booking_date, OPENING_TIME, BUSINESS_TIMEZONE)
    day_bookings = _branch_day_bookings(db, branch_id, cursor)
    nurse_capacity = _branch_nurse_capacity(db, branch_id)
    staff_names = {staff.id: staff.full_name for staff in db.query(User).filter(
        User.role == "staff", User.branch_id == branch_id, User.is_active.is_(True), User.job_title.isnot(None)
    ).all()}
    slots = []
    while cursor.time() <= LAST_START_TIME:
        booked = 0
        available = True
        assignments = []
        reason = None
        is_full = False
        try:
            assignments = validate_booking_schedule(db, branch_id, cursor, selected_services, online=True)
            if not _slot_has_resource_capacity(db, branch_id, cursor, selected_services, day_bookings, nurse_capacity=nurse_capacity):
                available = False
                reason = "Required equipment or qualified staff are unavailable."
        except HTTPException as error:
            available = False
            booked = 1
            is_full = error.status_code == 409
            reason = error.detail
        service_cursor = cursor
        assigned_services = []
        for selected_service, provider_id in zip(selected_services, assignments):
            duration = max(1, int(selected_service.duration_minutes or 0))
            assigned_services.append({"service_name": selected_service.name, "duration_minutes": duration,
                                      "provider_id": provider_id, "provider_name": staff_names.get(provider_id)})
            service_cursor += timedelta(minutes=duration)
        slots.append({
            "time": cursor.strftime("%H:%M"),
            "available": available,
            "is_full": is_full or reason == "Required equipment or qualified staff are unavailable.",
            "reason": reason,
            "booked": booked,
            "capacity": _slot_capacity(db, branch_id),
            "service_provider_ids": assignments,
            "assigned_services": assigned_services,
        })
        cursor += timedelta(minutes=SLOT_INTERVAL_MINUTES)
    return {"date": booking_date.isoformat(), "slots": slots, "lead_time_minutes": 30, "slot_interval_minutes": SLOT_INTERVAL_MINUTES}


@router.get("/availability")
def get_customer_booking_availability(
    branch_id: int,
    service_id: int,
    booking_date: date,
    service_ids: list[int] = Query(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    return _booking_availability(branch_id, service_id, booking_date, service_ids, db)


@router.get("/guest/availability")
def get_guest_booking_availability(
    branch_id: int,
    service_id: int,
    booking_date: date,
    service_ids: list[int] = Query(default=[]),
    db: Session = Depends(get_db),
):
    return _booking_availability(branch_id, service_id, booking_date, service_ids, db)


@router.post("/appointments", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_customer_appointment(
    payload: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    if not current_user.phone_verified or not current_user.phone_number:
        raise HTTPException(status_code=400, detail="Verify a mobile number in your account before booking so we can text your booking receipt and arrival policy.")
    try:
        customer_phone = normalize_phone_number(current_user.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Add a valid Philippine mobile number to your account before booking.") from exc
    cancel_overdue_bookings(db)

    # Serialize booking submissions for this branch so simultaneous requests
    # cannot both claim the last available staff slot.
    branch = _lock_booking_branch(db, payload.branch_id)
    requested_service_ids = list(dict.fromkeys(payload.service_ids or [payload.service_id]))
    services = db.query(Service).join(Service.branches).filter(Service.id.in_(requested_service_ids), Service.is_active.is_(True), Branch.id == payload.branch_id).all()
    service_map = {service.id: service for service in services}
    ordered_services = [service_map[service_id] for service_id in requested_service_ids if service_id in service_map]
    service = ordered_services[0] if ordered_services else None
    if not branch:
        raise HTTPException(status_code=404, detail="Selected branch is not available.")
    if not service or len(ordered_services) != len(requested_service_ids):
        raise HTTPException(status_code=404, detail="One or more selected services are not offered at this branch.")

    appointment_date = payload.appointment_date
    combined_duration = sum(item.duration_minutes or 0 for item in ordered_services)
    provider_ids = validate_booking_schedule(db, payload.branch_id, appointment_date, ordered_services, online=True)
    day_bookings = _branch_day_bookings(db, payload.branch_id, appointment_date)
    if not _slot_has_resource_capacity(db, payload.branch_id, appointment_date, ordered_services, day_bookings, nurse_capacity=_branch_nurse_capacity(db, payload.branch_id)):
        raise HTTPException(status_code=409, detail="The required equipment or a qualified nurse is unavailable at that time. Please choose another slot.")
    _reject_overlapping_customer_booking(
        db,
        appointment_date,
        combined_duration,
        customer_id=current_user.id,
        guest_phone=customer_phone,
        allow_exact_duplicate=payload.allow_duplicate,
        requested_service_ids={item.id for item in ordered_services},
    )
    booking = Booking(
        customer_id=current_user.id,
        guest_phone=customer_phone,
        branch_id=payload.branch_id,
        service_id=payload.service_id,
        appointment_date=payload.appointment_date,
        preferred_service_provider_id=None,
        notes=payload.notes,
        status="pending",
    )
    db.add(booking)
    db.flush()
    for selected_service, provider_id in zip(ordered_services, provider_ids):
        db.add(BookingServiceItem(booking_id=booking.id, service_id=selected_service.id, service_provider_id=provider_id))
    db.commit()
    db.refresh(booking)
    booking = _booking_query(db).filter(Booking.id == booking.id).first()
    return _start_online_booking_payment(db, booking, ordered_services, guest=False)


@router.post("/guest/appointments", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_guest_appointment(payload: GuestBookingCreateRequest, db: Session = Depends(get_db)):
    try:
        guest_phone = normalize_phone_number(payload.guest_phone)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    cancel_overdue_bookings(db)
    phone_challenge = _validated_guest_phone_challenge(db, payload.phone_verification_id, guest_phone)
    branch = _lock_booking_branch(db, payload.branch_id)
    requested_service_ids = list(dict.fromkeys(payload.service_ids or [payload.service_id]))
    services = db.query(Service).join(Service.branches).filter(
        Service.id.in_(requested_service_ids), Service.is_active.is_(True), Branch.id == payload.branch_id
    ).all()
    service_map = {service.id: service for service in services}
    ordered_services = [service_map[service_id] for service_id in requested_service_ids if service_id in service_map]
    if not branch:
        raise HTTPException(status_code=404, detail="Selected branch is not available.")
    if not ordered_services or len(ordered_services) != len(requested_service_ids):
        raise HTTPException(status_code=404, detail="One or more selected services are not offered at this branch.")

    duration = sum(service.duration_minutes or 0 for service in ordered_services)
    provider_ids = validate_booking_schedule(db, payload.branch_id, payload.appointment_date, ordered_services, online=True)
    day_bookings = _branch_day_bookings(db, payload.branch_id, payload.appointment_date)
    if not _slot_has_resource_capacity(db, payload.branch_id, payload.appointment_date, ordered_services, day_bookings, nurse_capacity=_branch_nurse_capacity(db, payload.branch_id)):
        raise HTTPException(status_code=409, detail="The required equipment or a qualified nurse is unavailable at that time. Please choose another slot.")
    _reject_overlapping_customer_booking(
        db,
        payload.appointment_date,
        duration,
        guest_phone=guest_phone,
        allow_exact_duplicate=payload.allow_duplicate,
        requested_service_ids={item.id for item in ordered_services},
    )
    booking = Booking(
        customer_id=None,
        guest_name=payload.guest_name,
        guest_phone=guest_phone,
        branch_id=payload.branch_id,
        service_id=ordered_services[0].id,
        appointment_date=payload.appointment_date,
        preferred_service_provider_id=None,
        notes=payload.notes,
        status="pending",
    )
    db.add(booking)
    db.flush()
    for selected_service, provider_id in zip(ordered_services, provider_ids):
        db.add(BookingServiceItem(booking_id=booking.id, service_id=selected_service.id, service_provider_id=provider_id))
    phone_challenge.consumed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(booking)
    booking = _booking_query(db).filter(Booking.id == booking.id).first()
    return _start_online_booking_payment(db, booking, ordered_services, guest=True)


@router.get("/appointments")
def list_customer_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    bookings = (
        _booking_query(db)
        .filter(Booking.customer_id == current_user.id)
        .order_by(Booking.created_at.desc(), Booking.id.desc())
        .all()
    )
    results = []
    for booking in bookings:
        item = BookingOut.model_validate(booking).model_dump()
        booking_payment = db.query(BookingPayment).filter(BookingPayment.booking_id == booking.id).first()
        item["payment_status"] = booking_payment.status if booking_payment else "unpaid"
        item["payment_amount"] = booking_payment.amount if booking_payment else None
        item["payment_method"] = booking_payment.payment_method if booking_payment else None
        item["payment_reference"] = booking_payment.payment_id if booking_payment and booking_payment.status == "paid" else None
        item["checkout_url"] = booking_payment.checkout_url if booking_payment and booking_payment.status == "pending" else None
        transaction = db.query(Transaction).filter(Transaction.booking_id == booking.id).order_by(Transaction.created_at.desc()).first()
        provider = transaction.service_provider if transaction and transaction.service_provider else booking.service_provider
        branch_staff = db.query(User).filter(User.role == "staff", User.branch_id == booking.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).order_by(User.full_name).all()
        item["service_provider"] = {"id": provider.id, "full_name": provider.full_name, "job_title": provider.job_title or "Salon Specialist"} if provider else None
        item["available_providers"] = [{"id": staff.id, "full_name": staff.full_name, "job_title": staff.job_title or "Salon Specialist"} for staff in branch_staff]
        if transaction:
            item["receipt"] = {
                "transaction_id": transaction.id,
                "amount": transaction.amount,
                "payment_method": transaction.payment_method,
                "additional_charge": transaction.additional_charge,
                "additional_charges": transaction.charge_reason,
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

    payment = db.query(BookingPayment).filter(BookingPayment.booking_id == booking.id).with_for_update().first()
    if payment and payment.status == "creating":
        raise HTTPException(status_code=409, detail="The secure checkout is still being prepared. Try cancelling again in a moment.")
    if payment and payment.status == "paid":
        raise HTTPException(status_code=409, detail="This booking has already been paid and is non-refundable. Please attend your scheduled appointment. Contact the branch if you need help with your booking.")
    if payment and payment.status == "pending":
        payment.status = "cancelled"
        db.query(BookingPaymentAttempt).filter(BookingPaymentAttempt.booking_payment_id == payment.id,
                                               BookingPaymentAttempt.status.in_(["creating", "pending"])).update(
            {BookingPaymentAttempt.status: "cancelled"}, synchronize_session=False)

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

    provider = db.query(User).filter(User.id == payload.service_provider_id, User.role == "staff", User.branch_id == booking.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).first()
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
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    if notification_id.startswith("receipt-"):
        try:
            receipt_id = int(notification_id.removeprefix("receipt-"))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Notification not found.") from exc
        exists = db.query(Transaction.id).join(Booking, Transaction.booking_id == Booking.id).filter(
            Transaction.id == receipt_id,
            Booking.customer_id == current_user.id,
        ).first()
    elif notification_id.startswith("payment-"):
        try:
            _, payment_id_text, payment_status = notification_id.split("-", 2)
            payment_id = int(payment_id_text)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Notification not found.") from exc
        exists = db.query(BookingPayment.id).join(Booking, BookingPayment.booking_id == Booking.id).filter(
            BookingPayment.id == payment_id,
            BookingPayment.status == payment_status,
            BookingPayment.status.in_(["for_verification", "rejected"]),
            Booking.customer_id == current_user.id,
        ).first()
    else:
        exists = None
    if not exists:
        raise HTTPException(status_code=404, detail="Notification not found.")
    read_marker = db.query(CustomerNotificationRead).filter_by(
        customer_id=current_user.id,
        notification_id=notification_id,
    ).first()
    if not read_marker:
        db.add(CustomerNotificationRead(customer_id=current_user.id, notification_id=notification_id))
        db.commit()
    return {
        "message": "Notification marked as read.",
        "notification_id": notification_id,
        "is_read": True,
    }
