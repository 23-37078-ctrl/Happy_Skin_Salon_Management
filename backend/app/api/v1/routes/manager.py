from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.crud.booking import get_booking_by_id, get_bookings_for_branch, update_booking_status
from app.crud.transaction import create_transaction, get_transactions_for_branch
from app.dependencies.permissions import require_manager_branch
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.feedback import Feedback
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User
from app.models.promotion import Promotion
from app.schemas.booking import BookingListResponse, BookingOut, BookingRescheduleRequest, BookingStatusUpdateRequest
from app.schemas.transaction import TransactionListResponse, TransactionOut
from app.schemas.user import PasswordUpdateRequest, ProfileUpdateRequest, UserOut
from app.services.forecast_service import build_branch_forecast

router = APIRouter(prefix="/manager", tags=["Manager"])


class PromotionRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    subtitle: str | None = Field(default=None, max_length=80)
    image_url: str | None = Field(default=None, max_length=500)
    start_date: date
    end_date: date
    is_active: bool = True

    @field_validator("title", "subtitle", "image_url")
    @classmethod
    def clean_promotion_text(cls, value):
        return value.strip() or None if isinstance(value, str) else value


def _promotion_out(item: Promotion) -> dict:
    return {"id": item.id, "branch_id": item.branch_id, "title": item.title, "subtitle": item.subtitle, "image": item.image_url, "image_url": item.image_url, "start_date": item.start_date, "end_date": item.end_date, "is_active": item.is_active, "created_at": item.created_at}


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


def _dashboard_period_bounds(period: str) -> tuple[datetime, datetime]:
    today = date.today()
    if period == "weekly":
        start = today - timedelta(days=6)
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "yearly":
        start = today.replace(month=1, day=1)
    else:
        raise HTTPException(status_code=400, detail="Period must be weekly, monthly, or yearly.")
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

    provider_customer_rows = (
        db.query(
            Transaction.service_provider_id.label("provider_id"),
            Booking.customer_id.label("customer_id"),
            func.count(Transaction.id).label("visits"),
        )
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Transaction.service_provider_id.isnot(None))
        .group_by(Transaction.service_provider_id, Booking.customer_id)
        .all()
    )
    provider_metrics = {}
    for row in provider_customer_rows:
        metrics = provider_metrics.setdefault(row.provider_id, {"total_visits": 0, "customers": 0, "repeat_customers": 0})
        metrics["total_visits"] += row.visits
        metrics["customers"] += 1
        if row.visits >= 2:
            metrics["repeat_customers"] += 1
    branch_providers = db.query(User).filter(User.role == "staff", User.branch_id == branch_id, User.is_active.is_(True), User.job_title.isnot(None)).all()
    providers = {item.id: item for item in branch_providers}
    for provider_id in providers:
        provider_metrics.setdefault(provider_id, {"total_visits": 0, "customers": 0, "repeat_customers": 0})
    provider_commissions = dict(
        db.query(Transaction.service_provider_id, func.coalesce(func.sum(Transaction.commission_amount), 0))
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Transaction.service_provider_id.isnot(None))
        .group_by(Transaction.service_provider_id)
        .all()
    )
    provider_ratings = {
        row.provider_id: {"average": round(float(row.average or 0), 1), "count": row.count}
        for row in db.query(Feedback.service_provider_id.label("provider_id"), func.avg(Feedback.staff_rating).label("average"), func.count(Feedback.id).label("count"))
        .filter(Feedback.service_provider_id.isnot(None), Feedback.staff_rating.isnot(None))
        .group_by(Feedback.service_provider_id).all()
    }
    staff_retention = sorted([
        {
            "staff_id": provider_id,
            "full_name": providers[provider_id].full_name,
            "job_title": providers[provider_id].job_title or "Salon Specialist",
            **metrics,
            "repeat_rate": round(metrics["repeat_customers"] / metrics["customers"] * 100, 1) if metrics["customers"] else 0,
            "commission_earned": float(provider_commissions.get(provider_id, 0) or 0),
            "average_rating": provider_ratings.get(provider_id, {}).get("average", 0),
            "rating_count": provider_ratings.get(provider_id, {}).get("count", 0),
        }
        for provider_id, metrics in provider_metrics.items() if provider_id in providers
    ], key=lambda item: (item["repeat_customers"], item["total_visits"]), reverse=True)

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
        },
        "recent_bookings": [BookingOut.model_validate(booking) for booking in recent_bookings],
        "recent_transactions": [TransactionOut.model_validate(transaction) for transaction in transactions],
        "branch_performance": [
            {"date": str(row.day), "bookings": row.bookings, "sales": float(row.sales or 0)}
            for row in performance_rows
        ],
        "staff_retention": staff_retention,
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


@router.get("/dashboard/performance")
def get_manager_dashboard_performance(
    period: str = Query("weekly", pattern="^(weekly|monthly|yearly)$"),
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    start, end = _dashboard_period_bounds(period)
    branch_id = current_user.branch_id
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    period_bookings = db.query(Booking).filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end)
    booking_count = period_bookings.count()
    completed = period_bookings.filter(Booking.status == "completed").count()
    cancelled = period_bookings.filter(Booking.status == "cancelled").count()
    sales = float(db.query(func.coalesce(func.sum(Transaction.amount), 0)).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Transaction.created_at >= start, Transaction.created_at < end).scalar() or 0)
    average_rating = float(db.query(func.avg(Feedback.branch_rating)).join(Booking, Feedback.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Feedback.branch_rating.isnot(None), Feedback.created_at >= start, Feedback.created_at < end).scalar() or 0)

    service_rows = db.query(Service.name, func.count(Booking.id).label("bookings")).join(Booking, Booking.service_id == Service.id).filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end).group_by(Service.name).order_by(func.count(Booking.id).desc()).limit(5).all()

    transaction_rows = db.query(Transaction.service_provider_id.label("provider_id"), func.count(Transaction.id).label("services"), func.coalesce(func.sum(Transaction.amount), 0).label("revenue"), func.coalesce(func.sum(Transaction.commission_amount), 0).label("commission")).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Transaction.service_provider_id.isnot(None), Transaction.created_at >= start, Transaction.created_at < end).group_by(Transaction.service_provider_id).all()
    transaction_metrics = {row.provider_id: row for row in transaction_rows}

    rating_rows = db.query(Feedback.service_provider_id.label("provider_id"), func.avg(Feedback.staff_rating).label("average"), func.count(Feedback.id).label("count")).join(Booking, Feedback.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Feedback.service_provider_id.isnot(None), Feedback.staff_rating.isnot(None), Feedback.created_at >= start, Feedback.created_at < end).group_by(Feedback.service_provider_id).all()
    rating_metrics = {row.provider_id: row for row in rating_rows}

    customer_rows = db.query(Transaction.service_provider_id.label("provider_id"), Booking.customer_id.label("customer_id"), func.count(Transaction.id).label("visits")).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Transaction.service_provider_id.isnot(None), Transaction.created_at >= start, Transaction.created_at < end).group_by(Transaction.service_provider_id, Booking.customer_id).all()
    repeat_metrics = {}
    for row in customer_rows:
        values = repeat_metrics.setdefault(row.provider_id, {"clients": 0, "repeat_clients": 0})
        values["clients"] += 1
        if row.visits >= 2:
            values["repeat_clients"] += 1

    staff_members = db.query(User).filter(User.role == "staff", User.branch_id == branch_id, User.is_active.is_(True), User.job_title.isnot(None)).all()
    staff_performance = []
    for staff in staff_members:
        transaction = transaction_metrics.get(staff.id)
        rating = rating_metrics.get(staff.id)
        retention = repeat_metrics.get(staff.id, {"clients": 0, "repeat_clients": 0})
        staff_performance.append({
            "staff_id": staff.id,
            "full_name": staff.full_name,
            "job_title": staff.job_title or "Salon Specialist",
            "services_completed": int(transaction.services if transaction else 0),
            "revenue": float(transaction.revenue if transaction else 0),
            "commission": float(transaction.commission if transaction else 0),
            "average_rating": round(float(rating.average or 0), 1) if rating else 0,
            "rating_count": int(rating.count if rating else 0),
            "repeat_clients": retention["repeat_clients"],
            "client_count": retention["clients"],
        })
    staff_performance.sort(key=lambda item: (item["revenue"], item["services_completed"], item["average_rating"]), reverse=True)

    return {
        "period": period,
        "start_date": start.date().isoformat(),
        "end_date": (end - timedelta(days=1)).date().isoformat(),
        "branch": {"id": branch_id, "name": branch.name if branch else "Assigned Branch", "address": branch.address if branch else None},
        "summary": {
            "bookings": booking_count,
            "completed": completed,
            "cancelled": cancelled,
            "completion_rate": round(completed / booking_count * 100, 1) if booking_count else 0,
            "sales": sales,
            "average_rating": round(average_rating, 1),
        },
        "services": [{"name": row.name, "bookings": row.bookings} for row in service_rows],
        "staff": staff_performance,
    }
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
    forecast = build_branch_forecast(db, current_user.branch_id)
    return {
        "branch_id": current_user.branch_id,
        "data_quality": forecast["data_quality"],
        "model": forecast["model"],
        "demand_forecast": forecast["predictions"],
        "workforce_recommendations": [
            {
                "date": point["date"],
                "demand_level": point["demand_level"],
                "recommendation": point["recommendation"],
                "reason": f"Predicted demand is {point['predicted_demand']} completed appointments.",
            }
            for point in forecast["predictions"]
        ],
        "message": forecast["limitation"],
    }


@router.get("/promotions")
def list_manager_promotions(current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    items = db.query(Promotion).filter(Promotion.branch_id == current_user.branch_id).order_by(Promotion.created_at.desc()).all()
    return {"promotions": [_promotion_out(item) for item in items]}


@router.post("/promotions", status_code=201)
def create_manager_promotion(payload: PromotionRequest, current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="Promotion end date cannot be earlier than its start date.")
    item = Promotion(branch_id=current_user.branch_id, created_by_id=current_user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _promotion_out(item)


@router.patch("/promotions/{promotion_id}")
def update_manager_promotion(promotion_id: int, payload: PromotionRequest, current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    item = db.query(Promotion).filter(Promotion.id == promotion_id, Promotion.branch_id == current_user.branch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Promotion not found for your branch.")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="Promotion end date cannot be earlier than its start date.")
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _promotion_out(item)


@router.delete("/promotions/{promotion_id}", status_code=204)
def delete_manager_promotion(promotion_id: int, current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    item = db.query(Promotion).filter(Promotion.id == promotion_id, Promotion.branch_id == current_user.branch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Promotion not found for your branch.")
    db.delete(item)
    db.commit()


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
