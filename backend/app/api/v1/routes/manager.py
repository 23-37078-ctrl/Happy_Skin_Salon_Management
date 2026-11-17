from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Date, and_, cast, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.crud.booking import get_booking_by_id, get_bookings_for_branch, update_booking_status
from app.crud.transaction import create_transaction, get_transactions_for_branch
from app.dependencies.permissions import require_manager_branch
from app.models.booking import Booking, BookingServiceItem
from app.models.booking_payment import BookingPayment
from app.models.branch import Branch
from app.models.feedback import Feedback
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.day_closure import DayClosure
from app.models.user import User
from app.models.promotion import Promotion
from app.schemas.booking import BookingListResponse, BookingOut, BookingRescheduleRequest, BookingStatusUpdateRequest, BookingServiceItemStatusRequest, BookingServiceProviderUpdateRequest
from app.services.booking_scheduling import validate_booking_schedule, lock_branch_schedule
from app.schemas.transaction import TransactionListResponse, TransactionOut
from app.schemas.user import PasswordUpdateRequest, ProfileUpdateRequest, UserOut
from app.services.forecast_service import build_branch_forecast

router = APIRouter(prefix="/manager", tags=["Manager"])
BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")
BUSINESS_OPEN_TIME = time(8, 30)
AUTOMATIC_CUTOFF_TIME = time(5, 0)


def _booking_out_with_payment(db: Session, booking: Booking) -> BookingOut:
    result = BookingOut.model_validate(booking)
    payment_status = db.query(BookingPayment.status).filter(BookingPayment.booking_id == booking.id).scalar()
    return result.model_copy(update={"payment_status": payment_status})


def _manager_business_date() -> date:
    local_now = datetime.now(BUSINESS_TIMEZONE)
    return local_now.date() if local_now.time() >= BUSINESS_OPEN_TIME else local_now.date() - timedelta(days=1)


def _manager_business_day_bounds(business_date: date) -> tuple[datetime, datetime]:
    local_start = datetime.combine(business_date, BUSINESS_OPEN_TIME, BUSINESS_TIMEZONE)
    local_end = datetime.combine(business_date + timedelta(days=1), AUTOMATIC_CUTOFF_TIME, BUSINESS_TIMEZONE)
    return local_start.astimezone(timezone.utc).replace(tzinfo=None), local_end.astimezone(timezone.utc).replace(tzinfo=None)

@router.get("/audit-logs")
def get_manager_audit_logs(current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    events = []
    bookings = db.query(Booking).filter(Booking.branch_id == current_user.branch_id).order_by(Booking.updated_at.desc()).limit(50).all()
    for booking in bookings:
        events.append({"type": "booking", "action": f"Booking marked {booking.status}", "actor": booking.customer.full_name if booking.customer else booking.guest_name or "Customer", "created_at": booking.updated_at or booking.created_at})
    transactions = (db.query(Transaction)
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id)
        .order_by(Transaction.created_at.desc()).limit(50).all())
    for transaction in transactions:
        events.append({"type": "transaction", "action": f"Payment recorded via {transaction.payment_method}", "actor": transaction.staff.full_name if transaction.staff else "Online payment", "created_at": transaction.created_at})
    events.sort(key=lambda event: event["created_at"] or datetime.min, reverse=True)
    return {"audit_logs": events[:100]}


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
        local_start = datetime.combine(start_date, time.min, BUSINESS_TIMEZONE)
        local_end = datetime.combine(end_date + timedelta(days=1), time.min, BUSINESS_TIMEZONE)
        return local_start.astimezone(timezone.utc).replace(tzinfo=None), local_end.astimezone(timezone.utc).replace(tzinfo=None)

    today = datetime.now(BUSINESS_TIMEZONE).date()
    if period == "daily":
        start = today
    elif period == "weekly":
        start = today - timedelta(days=6)
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "yearly":
        start = today.replace(month=1, day=1)
    else:
        raise HTTPException(status_code=400, detail="Period must be daily, weekly, monthly, or yearly.")

    local_start = datetime.combine(start, time.min, BUSINESS_TIMEZONE)
    local_end = datetime.combine(today + timedelta(days=1), time.min, BUSINESS_TIMEZONE)
    return local_start.astimezone(timezone.utc).replace(tzinfo=None), local_end.astimezone(timezone.utc).replace(tzinfo=None)


def _dashboard_period_bounds(period: str, report_date: date | None = None) -> tuple[datetime, datetime]:
    today = report_date or datetime.now(BUSINESS_TIMEZONE).date()
    if period == "daily":
        start = today
    elif period == "weekly":
        start = today - timedelta(days=6)
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "yearly":
        start = today.replace(month=1, day=1)
    else:
        raise HTTPException(status_code=400, detail="Period must be daily, weekly, monthly, or yearly.")
    local_start = datetime.combine(start, time.min, BUSINESS_TIMEZONE)
    local_end = datetime.combine(today + timedelta(days=1), time.min, BUSINESS_TIMEZONE)
    return local_start.astimezone(timezone.utc).replace(tzinfo=None), local_end.astimezone(timezone.utc).replace(tzinfo=None)


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
    salon_revenue_expr = Transaction.amount - func.coalesce(Transaction.commission_amount, 0)
    total_sales = (
        db.query(func.coalesce(func.sum(salon_revenue_expr), 0))
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id)
        .scalar()
    )
    total_staff_commission = (
        db.query(func.coalesce(func.sum(Transaction.commission_amount), 0))
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id)
        .scalar()
    )

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    recent_bookings, _ = get_bookings_for_branch(db, branch_id=branch_id, page=1, page_size=6)
    transactions, _ = get_transactions_for_branch(db, branch_id=branch_id, page=1, page_size=6)

    seven_days_ago = date.today() - timedelta(days=6)
    transaction_totals = db.query(
        Transaction.booking_id.label("booking_id"),
        func.sum(Transaction.amount - func.coalesce(Transaction.commission_amount, 0)).label("sales"),
    ).group_by(Transaction.booking_id).subquery()
    performance_rows = (
        db.query(
            cast(Booking.appointment_date, Date).label("day"),
            func.count(func.distinct(Booking.id)).label("bookings"),
            func.coalesce(func.sum(transaction_totals.c.sales), 0).label("sales"),
        )
        .outerjoin(transaction_totals, transaction_totals.c.booking_id == Booking.id)
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
        .filter(Booking.branch_id == branch_id, Booking.customer_id.isnot(None), Transaction.service_provider_id.isnot(None))
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
            "staff_commission": float(total_staff_commission or 0),
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
    payment_status_by_booking = {
        booking_id: payment_status
        for booking_id, payment_status in db.query(BookingPayment.booking_id, BookingPayment.status)
        .filter(BookingPayment.booking_id.in_([booking.id for booking in bookings]))
        .all()
    } if bookings else {}
    return BookingListResponse(
        bookings=[BookingOut.model_validate(booking).model_copy(update={"payment_status": payment_status_by_booking.get(booking.id)}) for booking in bookings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/booking-providers")
def list_manager_booking_providers(current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    staff = db.query(User).filter(User.role == "staff", User.branch_id == current_user.branch_id,
                                  User.is_active.is_(True), User.job_title.isnot(None)).order_by(User.full_name).all()
    return [{"id": item.id, "full_name": item.full_name, "job_title": item.job_title or "Salon Specialist"} for item in staff]


@router.get("/dashboard/performance")
def get_manager_dashboard_performance(
    period: str = Query("daily", pattern="^(daily|weekly|monthly|yearly)$"),
    report_date: date | None = Query(None),
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    start, end = _dashboard_period_bounds(period, report_date)
    branch_id = current_user.branch_id
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    period_bookings = db.query(Booking).filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end)
    booking_count = period_bookings.count()
    completed = period_bookings.filter(Booking.status == "completed").count()
    cancelled = period_bookings.filter(Booking.status == "cancelled").count()
    sales = float(db.query(func.coalesce(func.sum(Transaction.amount - func.coalesce(Transaction.commission_amount, 0)), 0)).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Transaction.created_at >= start, Transaction.created_at < end).scalar() or 0)
    staff_commission = float(db.query(func.coalesce(func.sum(Transaction.commission_amount), 0)).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Transaction.created_at >= start, Transaction.created_at < end).scalar() or 0)
    average_rating = float(db.query(func.avg(Feedback.branch_rating)).join(Booking, Feedback.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Feedback.branch_rating.isnot(None)).scalar() or 0)

    service_rows = db.query(Service.name, func.count(BookingServiceItem.id).label("bookings")).join(BookingServiceItem, BookingServiceItem.service_id == Service.id).join(Booking, Booking.id == BookingServiceItem.booking_id).filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end, BookingServiceItem.status != "cancelled").group_by(Service.name).order_by(func.count(BookingServiceItem.id).desc()).limit(5).all()

    transaction_rows = db.query(Transaction.service_provider_id.label("provider_id"), func.count(Transaction.id).label("services"), func.coalesce(func.sum(Transaction.amount - func.coalesce(Transaction.commission_amount, 0)), 0).label("revenue"), func.coalesce(func.sum(Transaction.commission_amount), 0).label("commission")).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Booking.group_reference.is_(None), Transaction.service_provider_id.isnot(None), Transaction.created_at >= start, Transaction.created_at < end).group_by(Transaction.service_provider_id).all()
    transaction_metrics = {row.provider_id: {"services": int(row.services), "revenue": float(row.revenue or 0), "commission": float(row.commission or 0)} for row in transaction_rows}
    group_service_rows = db.query(BookingServiceItem.service_provider_id.label("provider_id"), func.count(BookingServiceItem.id).label("services"), func.coalesce(func.sum(func.coalesce(BookingServiceItem.service_price, Service.price)), 0).label("revenue")).join(Booking, Booking.id == BookingServiceItem.booking_id).join(Service, Service.id == BookingServiceItem.service_id).filter(Booking.branch_id == branch_id, Booking.group_reference.isnot(None), Booking.appointment_date >= start, Booking.appointment_date < end, BookingServiceItem.status == "completed", BookingServiceItem.service_provider_id.isnot(None)).group_by(BookingServiceItem.service_provider_id).all()
    for row in group_service_rows:
        metrics = transaction_metrics.setdefault(row.provider_id, {"services": 0, "revenue": 0.0, "commission": 0.0})
        metrics["services"] += int(row.services)
        metrics["revenue"] += float(row.revenue or 0)

    # Ratings are a staff score across all recorded feedback, independent of
    # the selected bookings/revenue period. This keeps it meaningful in
    # shorter weekly and monthly views too.
    rating_rows = db.query(Feedback.service_provider_id.label("provider_id"), func.avg(Feedback.staff_rating).label("average"), func.count(Feedback.id).label("count")).join(Booking, Feedback.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Feedback.service_provider_id.isnot(None), Feedback.staff_rating.isnot(None)).group_by(Feedback.service_provider_id).all()
    rating_metrics = {row.provider_id: row for row in rating_rows}

    customer_rows = db.query(Transaction.service_provider_id.label("provider_id"), Booking.customer_id.label("customer_id"), func.count(Transaction.id).label("visits")).join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id, Booking.customer_id.isnot(None), Transaction.service_provider_id.isnot(None), Transaction.created_at >= start, Transaction.created_at < end).group_by(Transaction.service_provider_id, Booking.customer_id).all()
    repeat_metrics = {}
    for row in customer_rows:
        values = repeat_metrics.setdefault(row.provider_id, {"clients": 0, "repeat_clients": 0})
        values["clients"] += 1
        if row.visits >= 2:
            values["repeat_clients"] += 1

    staff_members = db.query(User).filter(User.role == "staff", User.branch_id == branch_id, User.is_active.is_(True), User.job_title.isnot(None)).all()
    staff_performance = []
    for staff in staff_members:
        transaction = transaction_metrics.get(staff.id, {"services": 0, "revenue": 0, "commission": 0})
        rating = rating_metrics.get(staff.id)
        retention = repeat_metrics.get(staff.id, {"clients": 0, "repeat_clients": 0})
        staff_performance.append({
            "staff_id": staff.id,
            "full_name": staff.full_name,
            "job_title": staff.job_title or "Salon Specialist",
            "services_completed": transaction["services"],
            "revenue": transaction["revenue"],
            "commission": transaction["commission"],
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
            "staff_commission": staff_commission,
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

    if booking.group_reference:
        if payload.status in {"completed", "cancelled"}:
            if payload.status == "completed":
                raise HTTPException(status_code=409, detail="Complete each group service assignment individually to avoid recording a duplicate sale.")
            raise HTTPException(status_code=409, detail="Cancel individual group service assignments from the group details.")
        booking.status = payload.status
        booking.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(booking)
        return BookingOut.model_validate(booking)

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
    if not lock_branch_schedule(db, current_user.branch_id):
        raise HTTPException(status_code=404, detail="Branch is not available.")
    booking = get_booking_by_id(db, booking_id, branch_id=current_user.branch_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for your branch.")
    if booking.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Completed or cancelled bookings cannot be rescheduled.")

    services = [item.service for item in booking.service_items] or [booking.service]
    provider_ids = validate_booking_schedule(
        db, booking.branch_id, payload.appointment_date, services, online=True,
        requested_provider_ids=[item.service_provider_id for item in booking.service_items],
        exclude_booking_id=booking.id,
    )

    booking.appointment_date = payload.appointment_date
    for item, provider_id in zip(booking.service_items, provider_ids):
        item.service_provider_id = provider_id
    booking.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)
    return _booking_out_with_payment(db, booking)


@router.patch("/bookings/{booking_id}/service-items/{service_item_id}/status")
def update_manager_group_service_status(
    booking_id: int,
    service_item_id: int,
    payload: BookingServiceItemStatusRequest,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).options(joinedload(Booking.service), selectinload(Booking.service_items)).filter(
        Booking.id == booking_id, Booking.branch_id == current_user.branch_id,
    ).first()
    if not booking or not booking.group_reference:
        raise HTTPException(status_code=404, detail="Group booking not found for your branch.")
    if booking.status not in {"confirmed", "treatment_done"}:
        raise HTTPException(status_code=409, detail="Group service statuses can only be changed after the booking is confirmed.")
    item = next((service_item for service_item in booking.service_items if service_item.id == service_item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Service assignment was not found in this group.")
    if item.status == "cancelled":
        raise HTTPException(status_code=409, detail="This service assignment was already cancelled.")
    if item.status == "completed":
        raise HTTPException(status_code=409, detail="This service assignment is already completed.")
    item.status = payload.status
    active_items = [service_item for service_item in booking.service_items if service_item.status != "cancelled"]
    if active_items and all(service_item.status == "completed" for service_item in active_items):
        booking.status = "completed"
    elif not active_items:
        booking.status = "cancelled"
    else:
        booking.status = "confirmed"
    db.commit()
    return {"booking_id": booking.id, "booking_status": booking.status,
            "service_item_id": item.id, "service_status": item.status}


@router.patch("/bookings/{booking_id}/service-items/{service_item_id}/provider")
def update_manager_group_service_provider(
    booking_id: int,
    service_item_id: int,
    payload: BookingServiceProviderUpdateRequest,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).options(selectinload(Booking.service_items).joinedload(BookingServiceItem.service)).filter(
        Booking.id == booking_id, Booking.branch_id == current_user.branch_id,
    ).first()
    if not booking or not booking.group_reference:
        raise HTTPException(status_code=404, detail="Group booking not found for your branch.")
    if booking.status != "confirmed":
        raise HTTPException(status_code=409, detail="Group staff can only be reassigned after confirmation and before completion.")
    target = next((item for item in booking.service_items if item.id == service_item_id), None)
    if not target or target.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=404, detail="Active service assignment was not found in this group.")
    if not lock_branch_schedule(db, booking.branch_id):
        raise HTTPException(status_code=404, detail="Branch is not available.")
    provider = db.query(User).filter(User.id == payload.service_provider_id, User.role == "staff",
        User.branch_id == booking.branch_id, User.is_active.is_(True), User.job_title.isnot(None)).first()
    if not provider:
        raise HTTPException(status_code=400, detail="Choose an active staff member from this branch.")
    target_start = target.appointment_start or booking.appointment_date
    target_end = target.appointment_end or target_start + timedelta(minutes=max(1, int(target.service_duration_minutes or target.service.duration_minutes or 0)))
    for item in booking.service_items:
        if item.id == target.id or item.status in {"completed", "cancelled"} or item.service_provider_id != provider.id:
            continue
        other_start = item.appointment_start or booking.appointment_date
        other_end = item.appointment_end or other_start + timedelta(minutes=max(1, int(item.service_duration_minutes or item.service.duration_minutes or 0)))
        if other_start < target_end and other_end > target_start:
            raise HTTPException(status_code=409, detail="This staff member already has an overlapping service in the group.")
    target.service_provider_id = provider.id
    db.commit()
    return {"booking_id": booking.id, "service_item_id": target.id, "service_provider_id": target.service_provider_id}


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
    period: str = Query("daily", pattern="^(daily|weekly|monthly|yearly|custom)$"),
    start_date: date | None = None,
    end_date: date | None = None,
    staff_id: int | None = None,
    service_id: int | None = None,
    booking_type: str | None = Query(None, pattern="^(online|walk_in|guest|registered)$"),
    appointment_status: str | None = Query(None, pattern="^(pending|confirmed|completed|cancelled)$"),
    payment_method: str | None = Query(None, pattern="^(cash|gcash|paypal|card|bank_transfer)$"),
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
    if staff_id:
        bookings_query = bookings_query.filter(or_(Booking.service_provider_id == staff_id, Booking.service_items.any(BookingServiceItem.service_provider_id == staff_id)))
    if service_id:
        bookings_query = bookings_query.filter(or_(Booking.service_id == service_id, Booking.service_items.any(BookingServiceItem.service_id == service_id)))
    if appointment_status:
        bookings_query = bookings_query.filter(Booking.status == appointment_status)
    if booking_type in {"online", "walk_in"}:
        bookings_query = bookings_query.filter(Booking.notes.like("Walk-in%") if booking_type == "walk_in" else ~Booking.notes.like("Walk-in%"))
    elif booking_type == "guest":
        bookings_query = bookings_query.filter(Booking.customer_id.is_(None))
    elif booking_type == "registered":
        bookings_query = bookings_query.filter(Booking.customer_id.isnot(None))
    transaction_query = (
        db.query(Transaction)
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Transaction.created_at >= start, Transaction.created_at < end)
    )
    if staff_id:
        transaction_query = transaction_query.filter(or_(Transaction.service_provider_id == staff_id, and_(Booking.group_reference.isnot(None), Booking.service_items.any(BookingServiceItem.service_provider_id == staff_id))))
    if service_id:
        transaction_query = transaction_query.filter(or_(Booking.service_id == service_id, Booking.service_items.any(BookingServiceItem.service_id == service_id)))
    if payment_method:
        transaction_query = transaction_query.filter(Transaction.payment_method == payment_method)

    filtered_transaction_totals = transaction_query.with_entities(
        Transaction.booking_id.label("booking_id"),
        func.sum(Transaction.amount - func.coalesce(Transaction.commission_amount, 0)).label("sales"),
    ).group_by(Transaction.booking_id).subquery()
    assignment_price = func.coalesce(BookingServiceItem.service_price, Service.price)
    assignment_totals = db.query(BookingServiceItem.booking_id.label("booking_id"), func.sum(assignment_price).label("total_price")).join(Service, Service.id == BookingServiceItem.service_id).filter(BookingServiceItem.status != "cancelled").group_by(BookingServiceItem.booking_id).subquery()
    service_rows = (
        db.query(Service.name, func.count(BookingServiceItem.id).label("bookings"), func.coalesce(func.sum(func.coalesce(filtered_transaction_totals.c.sales, 0) * func.coalesce(BookingServiceItem.service_price, Service.price) / func.nullif(assignment_totals.c.total_price, 0)), 0).label("sales"))
        .join(BookingServiceItem, BookingServiceItem.service_id == Service.id)
        .join(Booking, Booking.id == BookingServiceItem.booking_id)
        .outerjoin(assignment_totals, assignment_totals.c.booking_id == Booking.id)
        .outerjoin(filtered_transaction_totals, filtered_transaction_totals.c.booking_id == Booking.id)
        .filter(Booking.branch_id == branch_id, Booking.appointment_date >= start, Booking.appointment_date < end)
        .filter(or_(Booking.service_provider_id == staff_id, Booking.service_items.any(BookingServiceItem.service_provider_id == staff_id)) if staff_id else True)
        .filter(or_(Booking.service_id == service_id, Booking.service_items.any(BookingServiceItem.service_id == service_id)) if service_id else True)
        .filter(Booking.status == appointment_status if appointment_status else True)
        .filter(Booking.notes.like("Walk-in%") if booking_type == "walk_in" else (~Booking.notes.like("Walk-in%") if booking_type == "online" else True))
        .filter(Booking.customer_id.is_(None) if booking_type == "guest" else (Booking.customer_id.isnot(None) if booking_type == "registered" else True))
        .group_by(Service.name)
        .filter(BookingServiceItem.status != "cancelled")
        .order_by(func.count(BookingServiceItem.id).desc())
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
            "sales": float(transaction_query.with_entities(func.coalesce(func.sum(Transaction.amount - func.coalesce(Transaction.commission_amount, 0)), 0)).scalar() or 0),
            "staff_commission": float(transaction_query.with_entities(func.coalesce(func.sum(Transaction.commission_amount), 0)).scalar() or 0),
            "total_collected": float(transaction_query.with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0),
        },
        "services": [
            {"name": row.name, "bookings": row.bookings, "sales": float(row.sales or 0)}
            for row in service_rows
        ],
        "filters": {"staff_id": staff_id, "service_id": service_id, "booking_type": booking_type, "appointment_status": appointment_status, "payment_method": payment_method},
    }


@router.get("/reports/dates")
def list_manager_report_dates(
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    timestamps = (
        db.query(Transaction.created_at)
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id)
        .order_by(Transaction.created_at.desc())
        .limit(5000)
        .all()
    )
    current_business_date = _manager_business_date()
    business_dates = {current_business_date}
    for (created_at,) in timestamps:
        if not created_at:
            continue
        timestamp = created_at.replace(tzinfo=timezone.utc) if created_at.tzinfo is None else created_at
        local_timestamp = timestamp.astimezone(BUSINESS_TIMEZONE)
        business_date = local_timestamp.date() if local_timestamp.time() >= BUSINESS_OPEN_TIME else local_timestamp.date() - timedelta(days=1)
        if business_date <= current_business_date:
            business_dates.add(business_date)

    closures = db.query(DayClosure.business_date).filter(
        DayClosure.branch_id == current_user.branch_id,
        DayClosure.business_date <= current_business_date,
    ).all()
    business_dates.update(day for (day,) in closures if day)
    return {"dates": [day.isoformat() for day in sorted(business_dates, reverse=True)]}


@router.get("/reports/filters")
def get_manager_report_filters(current_user: User = Depends(require_manager_branch), db: Session = Depends(get_db)):
    staff = db.query(User).filter(User.branch_id == current_user.branch_id, User.role == "staff", User.is_active.is_(True)).order_by(User.full_name).all()
    services = db.query(Service).join(Service.branches).filter(Branch.id == current_user.branch_id, Service.is_active.is_(True)).order_by(Service.name).all()
    return {"staff": [{"id": item.id, "name": item.full_name} for item in staff], "services": [{"id": item.id, "name": item.name} for item in services]}


@router.get("/reports/day-summary")
def get_manager_day_report(
    report_date: date,
    current_user: User = Depends(require_manager_branch),
    db: Session = Depends(get_db),
):
    start, end = _manager_business_day_bounds(report_date)
    transactions = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.booking).joinedload(Booking.customer),
            joinedload(Transaction.booking).joinedload(Booking.service),
            joinedload(Transaction.booking).joinedload(Booking.branch),
            joinedload(Transaction.service_provider),
            joinedload(Transaction.staff),
        )
        .join(Booking, Transaction.booking_id == Booking.id)
        .filter(Booking.branch_id == current_user.branch_id, Transaction.created_at >= start, Transaction.created_at < end)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
    closure = db.query(DayClosure).options(joinedload(DayClosure.closed_by)).filter(
        DayClosure.branch_id == current_user.branch_id,
        DayClosure.business_date == report_date,
    ).first()
    automatic_cutoff = datetime.combine(report_date + timedelta(days=1), AUTOMATIC_CUTOFF_TIME, BUSINESS_TIMEZONE)
    automatically_closed = datetime.now(BUSINESS_TIMEZONE) >= automatic_cutoff
    automatic_cutoff_utc = automatic_cutoff.astimezone(timezone.utc).replace(tzinfo=None)
    methods = {method: 0.0 for method in ("cash", "gcash", "card", "bank_transfer")}
    provider_totals: dict[int, dict] = {}
    online_count = walk_in_count = 0
    total_collected = total_commission = 0.0

    transaction_rows = []
    for transaction in transactions:
        booking = transaction.booking
        amount = float(transaction.amount or 0)
        commission = float(transaction.commission_amount or 0)
        total_collected += amount
        total_commission += commission
        methods[transaction.payment_method] = methods.get(transaction.payment_method, 0.0) + amount
        if (booking.notes or "").startswith("Walk-in"):
            walk_in_count += 1
        else:
            online_count += 1
        provider = transaction.service_provider
        provider_id = provider.id if provider else 0
        row = provider_totals.setdefault(provider_id, {"name": provider.full_name if provider else "Unassigned", "services": 0, "commission": 0.0})
        row["services"] += 1
        row["commission"] += commission
        transaction_rows.append({
            "id": transaction.id,
            "booking": {
                "id": booking.id,
                "status": booking.status,
                "customer": {
                    "full_name": booking.customer.full_name if booking.customer else booking.guest_name,
                    "phone_number": booking.customer.phone_number if booking.customer else booking.guest_phone,
                },
                "service": {"name": booking.service.name} if booking.service else None,
                "branch": {"name": booking.branch.name} if booking.branch else None,
            },
            "staff": {"full_name": transaction.staff.full_name} if transaction.staff else None,
            "service_provider": {"full_name": provider.full_name} if provider else None,
            "amount": amount,
            "payment_method": transaction.payment_method,
            "additional_charge": float(transaction.additional_charge or 0),
            "charge_reason": transaction.charge_reason,
            "commission_amount": commission,
            "created_at": transaction.created_at,
        })

    return {
        "report_date": report_date,
        "branch_name": branch.name if branch else "Assigned Branch",
        "prepared_by": current_user.full_name,
        "generated_at": datetime.now(),
        "is_closed": bool(closure) or automatically_closed,
        "closed_at": closure.closed_at if closure else automatic_cutoff_utc if automatically_closed else None,
        "closed_by": closure.closed_by.full_name if closure and closure.closed_by else "Automatic 5:00 AM cutoff" if automatically_closed else None,
        "transaction_count": len(transactions),
        "transactions": transaction_rows,
        "online_count": online_count,
        "walk_in_count": walk_in_count,
        "total_collected": round(total_collected, 2),
        "salon_sales": round(total_collected - total_commission, 2),
        "commission_tips": round(total_commission, 2),
        "payment_methods": {key: round(value, 2) for key, value in methods.items()},
        "staff_performance": list(provider_totals.values()),
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
                "active_staff_count": point["active_staff_count"],
                "recommended_staff_count": point["recommended_staff_count"],
                "staffing_gap": point["staffing_gap"],
                "service_capacity": point["service_capacity"],
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
