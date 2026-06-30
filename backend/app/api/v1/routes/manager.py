from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.crud.booking import get_booking_by_id, get_bookings_for_branch, update_booking_status
from app.crud.inventory import build_inventory_summary, get_inventory_for_branch, get_low_stock_for_branch
from app.crud.transaction import create_transaction, get_transactions_for_branch
from app.dependencies.permissions import require_manager_branch
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.feedback import Feedback
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.booking import BookingListResponse, BookingOut, BookingRescheduleRequest, BookingStatusUpdateRequest
from app.schemas.inventory import InventoryItemOut, InventoryListResponse, InventorySummary
from app.schemas.transaction import TransactionListResponse, TransactionOut
from app.schemas.user import PasswordUpdateRequest, ProfileUpdateRequest, UserOut

router = APIRouter(prefix="/manager", tags=["Manager"])


def _today_bounds() -> tuple[datetime, datetime]:
    today = date.today()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    return start, end


def _period_bounds(period: str, start_date: date | None, end_date: date | None) -> tuple[datetime, datetime]:
    if start_date and end_date:
        if end_date < start_date:
            raise HTTPException(status_code=400, detail="End date must be after start date.")
        return datetime.combine(start_date, time.min), datetime.combine(end_date + timedelta(days=1), time.min)

    today = date.today()
    if period == "daily":
        start = today
    elif period == "weekly":
        start = today - timedelta(days=6)
    elif period == "monthly":
        start = today.replace(day=1)
    else:
        raise HTTPException(status_code=400, detail="Period must be daily, weekly, or monthly.")

    return datetime.combine(start, time.min), datetime.combine(today + timedelta(days=1), time.min)


@router.get("/dashboard")
def get_manager_dashboard(
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    start, end = _today_bounds()
    branch_id = current_user.branch_id

    today_bookings = (
        db.query(Booking)
        .filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end)
        .count()
    )
    completed_bookings = (
        db.query(Booking)
        .filter(Booking.branch_id == branch_id, Booking.status == "completed")
        .count()
    )
    pending_bookings = (
        db.query(Booking)
        .filter(Booking.branch_id == branch_id, Booking.status == "pending")
        .count()
    )
    low_stock_count = len(get_low_stock_for_branch(db, branch_id))
    total_sales = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id)
        .scalar()
    )

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    recent_bookings, _ = get_bookings_for_branch(db, branch_id=branch_id, page=1, page_size=6)
    transactions, _ = get_transactions_for_branch(db, branch_id=branch_id, page=1, page_size=6)

    seven_days_ago = date.today() - timedelta(days=6)
    performance_rows = (
        db.query(
            cast(Booking.appointment_date, Date).label("day"),
            func.count(Booking.id).label("bookings"),
            func.coalesce(func.sum(Transaction.amount), 0).label("sales"),
        )
        .outerjoin(Transaction, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Booking.appointment_date >= datetime.combine(seven_days_ago, time.min))
        .group_by(cast(Booking.appointment_date, Date))
        .order_by(cast(Booking.appointment_date, Date))
        .all()
    )

    return {
        "branch": {
            "id": branch.id if branch else branch_id,
            "name": branch.name if branch else "Assigned Branch",
            "address": branch.address if branch else None,
        },
        "stats": {
            "today_bookings": today_bookings,
            "completed_bookings": completed_bookings,
            "total_sales": float(total_sales or 0),
            "pending_bookings": pending_bookings,
            "low_stock_items": low_stock_count,
        },
        "recent_bookings": [BookingOut.model_validate(booking) for booking in recent_bookings],
        "recent_transactions": [TransactionOut.model_validate(transaction) for transaction in transactions],
        "branch_performance": [
            {"date": str(row.day), "bookings": row.bookings, "sales": float(row.sales or 0)}
            for row in performance_rows
        ],
    }


@router.get("/bookings", response_model=BookingListResponse)
def list_manager_bookings(
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = None,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    bookings, total = get_bookings_for_branch(
        db,
        branch_id=current_user.branch_id,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
    )
    return BookingListResponse(
        bookings=[BookingOut.model_validate(booking) for booking in bookings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/bookings/{booking_id}/status", response_model=BookingOut)
def update_manager_booking_status(
    booking_id: int,
    payload: BookingStatusUpdateRequest,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for your branch.")

    if payload.status == "completed":
        existing_transaction = (
            db.query(Transaction)
            .filter(Transaction.booking_id == booking.id)
            .first()
        )
        if not existing_transaction:
            create_transaction(
                db,
                booking=booking,
                staff_id=current_user.id,
                amount=None,
                payment_method="cash",
            )
            db.refresh(booking)
            return BookingOut.model_validate(booking)

    return BookingOut.model_validate(update_booking_status(db, booking, payload.status))


@router.patch("/bookings/{booking_id}/reschedule", response_model=BookingOut)
def reschedule_manager_booking(
    booking_id: int,
    payload: BookingRescheduleRequest,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for your branch.")
    if booking.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Completed or cancelled bookings cannot be rescheduled.")

    booking.appointment_date = payload.appointment_date
    booking.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)
    return BookingOut.model_validate(booking)


@router.get("/transactions", response_model=TransactionListResponse)
def list_manager_transactions(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    transactions, total = get_transactions_for_branch(
        db,
        branch_id=current_user.branch_id,
        page=page,
        page_size=page_size,
    )
    return TransactionListResponse(
        transactions=[TransactionOut.model_validate(transaction) for transaction in transactions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/inventory", response_model=InventoryListResponse)
def get_manager_inventory(
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    items = get_inventory_for_branch(db, current_user.branch_id)
    low_stock_items = get_low_stock_for_branch(db, current_user.branch_id)
    return InventoryListResponse(
        items=[InventoryItemOut.model_validate(item) for item in items],
        low_stock_items=[InventoryItemOut.model_validate(item) for item in low_stock_items],
        summary=InventorySummary(**build_inventory_summary(items, low_stock_items)),
    )


@router.get("/reports")
def get_manager_reports(
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    start_date: date | None = None,
    end_date: date | None = None,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    start, end = _period_bounds(period, start_date, end_date)
    branch_id = current_user.branch_id

    bookings_query = db.query(Booking).filter(
        Booking.branch_id == branch_id,
        Booking.appointment_date >= start,
        Booking.appointment_date < end,
    )
    transaction_query = (
        db.query(Transaction)
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Transaction.created_at >= start, Transaction.created_at < end)
    )

    service_rows = (
        db.query(Service.name, func.count(Booking.id).label("bookings"), func.coalesce(func.sum(Transaction.amount), 0).label("sales"))
        .join(Booking, Booking.service_id == Service.id)
        .outerjoin(Transaction, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end)
        .group_by(Service.name)
        .order_by(func.count(Booking.id).desc())
        .all()
    )

    return {
        "period": period,
        "start_date": start.date().isoformat(),
        "end_date": (end - timedelta(days=1)).date().isoformat(),
        "summary": {
            "bookings": bookings_query.count(),
            "completed": bookings_query.filter(Booking.status == "completed").count(),
            "pending": bookings_query.filter(Booking.status == "pending").count(),
            "cancelled": bookings_query.filter(Booking.status == "cancelled").count(),
            "sales": float(transaction_query.with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0),
        },
        "services": [
            {"name": row.name, "bookings": row.bookings, "sales": float(row.sales or 0)}
            for row in service_rows
        ],
    }


@router.get("/forecasting")
def get_manager_forecasting(
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    return {
        "demand_forecast": [],
        "workforce_recommendations": [],
        "message": "Forecasting and workforce recommendations are not available for this branch yet.",
    }


@router.get("/feedback")
def list_manager_feedback(
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    feedback_rows = (
        db.query(Feedback)
        .join(Booking, Feedback.booking_id == Booking.id)
        .options(
            joinedload(Feedback.customer),
            joinedload(Feedback.booking).joinedload(Booking.service),
        )
        .filter(Booking.branch_id == current_user.branch_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
    average_rating = (
        db.query(func.avg(Feedback.rating))
        .join(Booking, Feedback.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id)
        .scalar()
    )

    return {
        "average_rating": float(average_rating or 0),
        "total": len(feedback_rows),
        "feedback": [
            {
                "id": item.id,
                "rating": item.rating,
                "review": item.review,
                "created_at": item.created_at,
                "customer": {"id": item.customer.id, "full_name": item.customer.full_name, "email": item.customer.email},
                "booking": {
                    "id": item.booking.id,
                    "service": item.booking.service.name if item.booking and item.booking.service else "Service",
                    "appointment_date": item.booking.appointment_date if item.booking else None,
                },
            }
            for item in feedback_rows
        ],
    }


@router.get("/profile", response_model=UserOut)
def get_manager_profile(current_user: User = Depends(require_manager_branch)):
    return UserOut.model_validate(current_user)


@router.patch("/profile", response_model=UserOut)
def update_manager_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    current_user.full_name = payload.full_name
    current_user.phone_number = payload.phone_number
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.patch("/profile/password")
def update_manager_password(
    payload: PasswordUpdateRequest,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Password updated successfully."}
