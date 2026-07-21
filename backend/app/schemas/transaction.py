from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# ── Request Schemas ──────────────────────────────────────────────

class TransactionCreateRequest(BaseModel):
    booking_id: int
    amount: Optional[float] = None
    # If amount is not provided, it will default to the booking's service price.
    payment_method: str = "cash"
    service_provider_id: Optional[int] = None
    amount_tendered: Optional[float] = None
    additional_charges: list[dict] = Field(default_factory=list)
    commission_rate: float = 10

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


    @field_validator("commission_rate")
    @classmethod
    def booking_commission_is_valid(cls, value: float) -> float:
        if value < 0 or value > 100:
            raise ValueError("Commission rate must be between 0 and 100.")
        return value


class AdditionalChargeItem(BaseModel):
    reason: str
    amount: float

    @field_validator("reason")
    @classmethod
    def reason_is_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Every additional charge must have a reason.")
        return value

    @field_validator("amount")
    @classmethod
    def amount_is_positive(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Every additional charge must be greater than zero.")
        return value


class WalkInCheckoutRequest(BaseModel):
    customer_name: str
    phone_number: Optional[str] = None
    service_id: int
    payment_method: str = "cash"
    amount_tendered: Optional[float] = None
    notes: Optional[str] = None
    service_provider_id: int
    additional_charges: list[AdditionalChargeItem] = Field(default_factory=list)
    # Legacy aggregate fields remain accepted for older clients.
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

    @model_validator(mode="after")
    def charge_reason_is_required(self):
        if self.additional_charges:
            return self
        if self.additional_charge > 0 and not (self.charge_reason or "").strip():
            raise ValueError("Charge reason is required when an additional charge is added.")
        self.charge_reason = (self.charge_reason or "").strip() or None
        return self


# ── Response Schemas ─────────────────────────────────────────────

class TransactionStaffOut(BaseModel):
    id: int
    full_name: str

    model_config = {"from_attributes": True}


class TransactionServiceOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class TransactionBookingOut(BaseModel):
    id: int
    appointment_date: datetime
    status: str
    customer: Optional[TransactionStaffOut] = None
    service: Optional[TransactionServiceOut] = None

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: int
    booking: TransactionBookingOut
    staff: TransactionStaffOut
    service_provider: Optional[TransactionStaffOut] = None
    amount: float
    payment_method: str
    additional_charge: float = 0
    charge_reason: Optional[str] = None
    commission_rate: float = 0
    commission_amount: float = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionOut]
    total: int
    page: int
    page_size: int
