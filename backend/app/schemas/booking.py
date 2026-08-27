from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_serializer, field_validator


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
    customer: BookingCustomerOut
    branch: BookingBranchOut
    service: BookingServiceOut
    service_provider: Optional[BookingProviderOut] = None
    preferred_service_provider: Optional[BookingProviderOut] = None
    service_items: list[BookingServiceItemOut] = Field(default_factory=list)
    appointment_date: datetime
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
