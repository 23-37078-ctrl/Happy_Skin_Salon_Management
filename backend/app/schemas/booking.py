from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator


BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")


def normalize_appointment_date(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=BUSINESS_TIMEZONE)
    return value.astimezone(timezone.utc)


# ── Request Schemas ──────────────────────────────────────────────

class BookingCreateRequest(BaseModel):
    branch_id: int
    service_id: int
    service_ids: list[int] = Field(default_factory=list)
    appointment_date: datetime
    allow_duplicate: bool = False
    phone_verification_id: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=255)

    @field_validator("appointment_date")
    @classmethod
    def normalize_appointment_time(cls, value: datetime) -> datetime:
        return normalize_appointment_date(value)

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("service_ids")
    @classmethod
    def validate_service_ids(cls, value: list[int]) -> list[int]:
        unique = list(dict.fromkeys(value))
        if len(unique) > 20:
            raise ValueError("A booking can contain at most 20 services.")
        return unique


class GuestBookingCreateRequest(BookingCreateRequest):
    guest_name: str = Field(min_length=2, max_length=100)
    guest_email: EmailStr
    guest_phone: str = Field(min_length=7, max_length=20)
    phone_verification_id: str = Field(min_length=36, max_length=36)

    @field_validator("guest_name", "guest_email", "guest_phone", mode="before")
    @classmethod
    def trim_guest_contact(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("guest_phone")
    @classmethod
    def validate_guest_phone(cls, value: str) -> str:
        digits = "".join(character for character in value if character.isdigit())
        if not 7 <= len(digits) <= 15 or any(character not in "+0123456789 ()-" for character in value):
            raise ValueError("Enter a valid mobile number.")
        return value


class BookingStatusUpdateRequest(BaseModel):
    status: str
    service_provider_id: Optional[int] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        allowed = {"pending", "confirmed", "completed", "cancelled"}
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return v

class BookingCancellationRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=255)


class BookingRescheduleRequest(BaseModel):
    appointment_date: datetime

    @field_validator("appointment_date")
    @classmethod
    def normalize_appointment_time(cls, value: datetime) -> datetime:
        return normalize_appointment_date(value)


# ── Response Schemas ─────────────────────────────────────────────

class BookingCustomerOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone_number: Optional[str] = None

    model_config = {"from_attributes": True}


class BookingServiceOut(BaseModel):
    id: int
    name: str
    price: float
    duration_minutes: Optional[int] = None

    model_config = {"from_attributes": True}


class BookingBranchOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class BookingProviderOut(BaseModel):
    id: int
    full_name: str
    job_title: Optional[str] = None

    model_config = {"from_attributes": True}


class BookingServiceItemOut(BaseModel):
    id: int
    service: BookingServiceOut
    service_provider: Optional[BookingProviderOut] = None

    model_config = {"from_attributes": True}


class BookingOut(BaseModel):
    id: int
    customer: Optional[BookingCustomerOut] = None
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    branch: BookingBranchOut
    service: BookingServiceOut
    service_provider: Optional[BookingProviderOut] = None
    preferred_service_provider: Optional[BookingProviderOut] = None
    service_items: list[BookingServiceItemOut] = Field(default_factory=list)
    appointment_date: datetime
    checked_in_at: Optional[datetime] = None
    confirmation_sms_sent: Optional[bool] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("appointment_date")
    def serialize_appointment_time(self, value: datetime) -> str:
        if value.tzinfo is not None:
            value = value.astimezone(BUSINESS_TIMEZONE)
        else:
            value = value.replace(tzinfo=BUSINESS_TIMEZONE)
        return value.isoformat()


class BookingListResponse(BaseModel):
    bookings: list[BookingOut]
    total: int
    page: int
    page_size: int
