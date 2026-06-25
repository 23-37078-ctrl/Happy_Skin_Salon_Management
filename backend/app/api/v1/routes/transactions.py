from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.booking import get_booking_by_id
from app.crud.transaction import create_transaction, get_transactions_for_branch
from app.dependencies.permissions import require_staff_branch
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreateRequest,
    TransactionListResponse,
    TransactionOut,
)

router = APIRouter(prefix="/staff/transactions", tags=["Staff - Transactions"])


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

    transaction = create_transaction(
        db,
        booking=booking,
        staff_id=current_user.id,
        amount=payload.amount,
        payment_method=payload.payment_method,
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