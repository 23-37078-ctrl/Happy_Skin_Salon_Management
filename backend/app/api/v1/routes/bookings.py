from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.booking import (
    get_booking_by_id,
    get_bookings_for_branch,
    update_booking_status,
)
from app.dependencies.permissions import require_staff_branch
from app.models.user import User
from app.schemas.booking import BookingListResponse, BookingOut, BookingStatusUpdateRequest

router = APIRouter(prefix="/staff/bookings", tags=["Staff - Bookings"])


@router.get("", response_model=BookingListResponse)
def list_branch_bookings(
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = None,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be 1 or greater.")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Page size must be between 1 and 100.")

    bookings, total = get_bookings_for_branch(
        db,
        branch_id=current_user.branch_id,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
    )

    return BookingListResponse(
        bookings=[BookingOut.model_validate(b) for b in bookings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{booking_id}", response_model=BookingOut)
def get_branch_booking(
    booking_id: int,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    return BookingOut.model_validate(booking)


@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_branch_booking_status(
    booking_id: int,
    payload: BookingStatusUpdateRequest,
    current_user: User = Depends(require_staff_branch),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    updated = update_booking_status(db, booking, payload.status)
    return BookingOut.model_validate(updated)