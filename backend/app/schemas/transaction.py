from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


# ── Request Schemas ──────────────────────────────────────────────

class TransactionCreateRequest(BaseModel):
    booking_id: int
    amount: Optional[float] = None
    # If amount is not provided, it will default to the booking's service price.
    payment_method: str = "cash"

    @field_validator("payment_method")
    @classmethod
    def payment_method_must_be_valid(cls, v: str) -> str:
        allowed = {"cash", "gcash", "card", "bank_transfer"}
        if v not in allowed:
            raise ValueError(f"Payment method must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Amount must be greater than zero.")
        return v


# ── Response Schemas ─────────────────────────────────────────────

class TransactionStaffOut(BaseModel):
    id: int
    full_name: str

    model_config = {"from_attributes": True}


class TransactionBookingOut(BaseModel):
    id: int
    appointment_date: datetime
    status: str

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: int
    booking: TransactionBookingOut
    staff: TransactionStaffOut
    amount: float
    payment_method: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionOut]
    total: int
    page: int
    page_size: int