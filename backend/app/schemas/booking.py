from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


# ── Request Schemas ──────────────────────────────────────────────

class BookingCreateRequest(BaseModel):
    branch_id: int
    service_id: int
    appointment_date: datetime
    notes: Optional[str] = None


class BookingStatusUpdateRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        allowed = {"pending", "confirmed", "completed", "cancelled"}
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return v


class BookingRescheduleRequest(BaseModel):
    appointment_date: datetime


# ── Response Schemas ─────────────────────────────────────────────

class BookingCustomerOut(BaseModel):
    id: int
    full_name: str
    email: str

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


class BookingOut(BaseModel):
    id: int
    customer: BookingCustomerOut
    branch: BookingBranchOut
    service: BookingServiceOut
    appointment_date: datetime
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BookingListResponse(BaseModel):
    bookings: list[BookingOut]
    total: int
    page: int
    page_size: int
