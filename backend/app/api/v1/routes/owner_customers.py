from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.permissions import require_role
from app.models.user import User
from app.services.sms_service import normalize_phone_number

router = APIRouter(prefix="/owner/customers", tags=["Owner customer management"])


class CustomerUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone_number: str | None = Field(default=None, max_length=20)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter the customer's full name.")
        return value


def _customers(db: Session):
    return db.query(User).filter(User.role == "customer")


def _out(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "created_at": user.created_at,
    }


@router.get("")
def list_customers(
    search: str | None = Query(default=None, max_length=100),
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    query = _customers(db)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.email.ilike(term), User.phone_number.ilike(term)))
    customers = query.order_by(User.full_name.asc()).limit(300).all()
    return {"customers": [_out(customer) for customer in customers]}


@router.patch("/{customer_id}")
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    customer = _customers(db).filter(User.id == customer_id).with_for_update().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer account was not found.")

    email = str(payload.email).strip().lower()
    duplicate_email = db.query(User.id).filter(
        func.lower(User.email) == email, User.id != customer.id,
    ).first()
    if duplicate_email:
        raise HTTPException(status_code=409, detail="That email is already used by another account.")

    phone = None
    if payload.phone_number and payload.phone_number.strip():
        try:
            phone = normalize_phone_number(payload.phone_number)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    email_changed = email != customer.email.lower()
    phone_changed = phone != customer.phone_number
    customer.full_name = payload.full_name
    customer.email = email
    customer.phone_number = phone
    if email_changed:
        # An owner changing the address must not leave the new address marked verified.
        customer.email_verified = False
    if phone_changed:
        # An edited phone is not treated as SMS-verified; the customer can verify it from their profile.
        customer.phone_verified = False
    customer.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # The pre-check gives a friendly message in the usual case; this also covers
        # simultaneous edits that race with another account claiming the same email.
        raise HTTPException(
            status_code=409,
            detail="These customer details conflict with another account. Check the email address and try again.",
        ) from exc
    db.refresh(customer)
    result = _out(customer)
    result["email_changed"] = email_changed
    result["phone_changed"] = phone_changed
    return result
