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


class WalkInCheckoutRequest(BaseModel):
    customer_name: str
    phone_number: Optional[str] = None
    service_id: int
    payment_method: str = "cash"
    service_provider_id: Optional[int] = None
    amount_tendered: Optional[float] = None
    notes: Optional[str] = None
    service_provider_id: int
    additional_charge: float = 0
    charge_reason: Optional[str] = None
    commission_rate: float = 10

    @field_validator("customer_name")
    @classmethod
    def customer_name_is_required(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Customer name must contain at least 2 characters.")
        return value

    @field_validator("payment_method")
    @classmethod
    def walk_in_payment_method_is_valid(cls, value: str) -> str:
        allowed = {"cash", "gcash", "card", "bank_transfer"}
        if value not in allowed:
            raise ValueError(f"Payment method must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("amount_tendered")
    @classmethod
    def amount_tendered_must_be_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Amount tendered cannot be negative.")
        return v

    @field_validator("additional_charge")
    @classmethod
    def additional_charge_is_valid(cls, value: float) -> float:
        if value < 0:
            raise ValueError("Additional charge cannot be negative.")
        return value

    @field_validator("commission_rate")
    @classmethod
    def commission_rate_is_valid(cls, value: float) -> float:
        if value < 0 or value > 100:
            raise ValueError("Commission rate must be between 0 and 100.")
        return value


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
