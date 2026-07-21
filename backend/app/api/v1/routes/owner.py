from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import hash_password
from app.dependencies.permissions import require_role
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.feedback import Feedback
from app.models.inventory import InventoryItem
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/owner", tags=["Owner"])


class BranchPayload(BaseModel):
    name: str
    address: str
    phone: str | None = None
    is_active: bool = True

    @field_validator("name", "address")
    @classmethod
    def required_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field is required.")
        return value.strip()


class UserCreatePayload(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str
    branch_id: int | None = None
    phone_number: str | None = None

    @field_validator("full_name")
    @classmethod
    def name_required(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Full name is required.")
        return value.strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return value

    @field_validator("role")
    @classmethod
    def valid_role(cls, value: str) -> str:
        allowed = {"owner", "manager", "staff", "customer"}
        if value not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return value


class UserUpdatePayload(BaseModel):
    full_name: str
    role: str
    branch_id: int | None = None
    phone_number: str | None = None
    email_verified: bool = True

    @field_validator("full_name")
    @classmethod
    def update_name_required(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Full name is required.")
        return value.strip()

    @field_validator("role")
    @classmethod
    def update_valid_role(cls, value: str) -> str:
        return UserCreatePayload.valid_role(value)


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


def _serialize_branch(branch: Branch) -> dict:
    return {
        "id": branch.id,
        "name": branch.name,
        "address": branch.address,
        "phone": branch.phone,
        "is_active": branch.is_active,
        "created_at": branch.created_at,
        "updated_at": branch.updated_at,
    }


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "branch_id": user.branch_id,
        "phone_number": user.phone_number,
        "email_verified": user.email_verified,
        "created_at": user.created_at,
    }


def _serialize_booking(booking: Booking) -> dict:
    return {
        "id": booking.id,
        "customer": {
            "id": booking.customer.id,
            "full_name": booking.customer.full_name,
            "email": booking.customer.email,
        } if booking.customer else None,
        "branch": {"id": booking.branch.id, "name": booking.branch.name} if booking.branch else None,
        "service": {
            "id": booking.service.id,
            "name": booking.service.name,
            "price": booking.service.price,
            "duration_minutes": booking.service.duration_minutes,
        } if booking.service else None,
        "appointment_date": booking.appointment_date,
        "status": booking.status,
        "notes": booking.notes,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
    }


def _serialize_transaction(transaction: Transaction) -> dict:
    booking = transaction.booking
    return {
        "id": transaction.id,
        "amount": transaction.amount,
        "payment_method": transaction.payment_method,
        "created_at": transaction.created_at,
        "staff": {
            "id": transaction.staff.id,
            "full_name": transaction.staff.full_name,
        } if transaction.staff else None,
        "booking": {
            "id": booking.id,
            "appointment_date": booking.appointment_date,
            "status": booking.status,
            "branch": {"id": booking.branch.id, "name": booking.branch.name} if booking and booking.branch else None,
            "service": {"id": booking.service.id, "name": booking.service.name} if booking and booking.service else None,
            "customer": {"id": booking.customer.id, "full_name": booking.customer.full_name} if booking and booking.customer else None,
        } if booking else None,
    }


def _booking_query(db: Session):
    return db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.branch),
        joinedload(Booking.service),
    )


def _transaction_query(db: Session):
    return db.query(Transaction).options(
        joinedload(Transaction.staff),
        joinedload(Transaction.booking).joinedload(Booking.branch),
        joinedload(Transaction.booking).joinedload(Booking.service),
        joinedload(Transaction.booking).joinedload(Booking.customer),
    )


@router.get("/dashboard")
def get_owner_dashboard(
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    today = date.today()
    today_start = datetime.combine(today, time.min)
    tomorrow_start = today_start + timedelta(days=1)

    total_sales = db.query(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    today_bookings = db.query(Booking).filter(
        Booking.appointment_date >= today_start,
        Booking.appointment_date < tomorrow_start,
    ).count()

    stats = {
        "branches": db.query(Branch).count(),
        "active_branches": db.query(Branch).filter(Branch.is_active.is_(True)).count(),
        "users": db.query(User).count(),
        "bookings": db.query(Booking).count(),
        "pending_bookings": db.query(Booking).filter(Booking.status == "pending").count(),
        "today_bookings": today_bookings,
        "transactions": db.query(Transaction).count(),
        "total_sales": float(total_sales),
        "low_stock_items": db.query(InventoryItem).filter(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity <= InventoryItem.minimum_stock,
        ).count(),
    }

    branch_rows = (
        db.query(
            Branch.id,
            Branch.name,
            func.count(Booking.id).label("bookings"),
            func.coalesce(func.sum(Transaction.amount), 0).label("sales"),
        )
        .outerjoin(Booking, Booking.branch_id == Branch.id)
        .outerjoin(Transaction, Transaction.booking_id == Booking.id)
        .group_by(Branch.id, Branch.name)
        .order_by(Branch.name.asc())
        .all()
    )
    branch_rankings = []
    for row in branch_rows:
        completed = db.query(Booking).filter(Booking.branch_id == row.id, Booking.status == "completed").count()
        total = int(row.bookings or 0)
        branch_rankings.append({
            "branch_id": row.id,
            "branch": row.name,
            "bookings": total,
            "completed": completed,
            "sales": float(row.sales or 0),
            "completion_rate": round(completed / total * 100, 1) if total else 0,
        })
    branch_rankings.sort(key=lambda item: (item["sales"], item["completed"], item["bookings"]), reverse=True)
    for index, item in enumerate(branch_rankings, start=1):
        item["rank"] = index

    service_rows = (
        db.query(
            Service.name,
            func.count(Booking.id).label("bookings"),
            func.coalesce(func.sum(Transaction.amount), 0).label("sales"),
        )
        .outerjoin(Booking, Booking.service_id == Service.id)
        .outerjoin(Transaction, Transaction.booking_id == Booking.id)
        .group_by(Service.name)
        .order_by(func.count(Booking.id).desc())
        .limit(6)
        .all()
    )

    return {
        "stats": stats,
        "branch_performance": [
            {"branch_id": row.id, "branch": row.name, "bookings": row.bookings, "sales": float(row.sales or 0)}
            for row in branch_rows
        ],
        "branch_rankings": branch_rankings,
        "top_branch": branch_rankings[0] if branch_rankings else None,
        "service_demand": [
            {"service": row.name, "bookings": row.bookings, "sales": float(row.sales or 0)}
            for row in service_rows
        ],
        "recent_bookings": [_serialize_booking(item) for item in _booking_query(db).order_by(Booking.created_at.desc()).limit(6).all()],
        "recent_transactions": [
            _serialize_transaction(item)
            for item in _transaction_query(db).order_by(Transaction.created_at.desc()).limit(6).all()
        ],
    }


@router.get("/branches")
def list_owner_branches(
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    branches = db.query(Branch).order_by(Branch.name.asc()).all()
    return {
        "branches": [
            {
                **_serialize_branch(branch),
                "bookings": db.query(Booking).filter(Booking.branch_id == branch.id).count(),
                "sales": float(
                    db.query(func.coalesce(func.sum(Transaction.amount), 0))
                    .join(Booking, Transaction.booking_id == Booking.id)
                    .filter(Booking.branch_id == branch.id)
                    .scalar()
                    or 0
                ),
                "assigned_users": db.query(User).filter(User.branch_id == branch.id).count(),
            }
            for branch in branches
        ]
    }


@router.post("/branches", status_code=201)
def create_owner_branch(
    payload: BranchPayload,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    branch = Branch(**payload.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _serialize_branch(branch)


@router.patch("/branches/{branch_id}")
def update_owner_branch(
    branch_id: int,
    payload: BranchPayload,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found.")
    for field, value in payload.model_dump().items():
        setattr(branch, field, value)
    branch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(branch)
    return _serialize_branch(branch)


@router.get("/users")
def list_owner_users(
    role: str | None = None,
    branch_id: int | None = None,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    query = db.query(User).order_by(User.created_at.desc())
    if role:
        query = query.filter(User.role == role)
    if branch_id:
        query = query.filter(User.branch_id == branch_id)
    branches = {branch.id: branch.name for branch in db.query(Branch).all()}
    return {
        "users": [
            {**_serialize_user(user), "branch_name": branches.get(user.branch_id)}
            for user in query.all()
        ],
        "branches": [{"id": key, "name": value} for key, value in branches.items()],
    }


@router.post("/users", status_code=201)
def create_owner_user(
    payload: UserCreatePayload,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email is already registered.")
    if payload.branch_id and not db.query(Branch).filter(Branch.id == payload.branch_id).first():
        raise HTTPException(status_code=404, detail="Branch not found.")
    user = User(
        full_name=payload.full_name,
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        branch_id=payload.branch_id,
        phone_number=payload.phone_number,
        email_verified=True,
        otp_method="email",
        verified_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.patch("/users/{user_id}")
def update_owner_user(
    user_id: int,
    payload: UserUpdatePayload,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if payload.branch_id and not db.query(Branch).filter(Branch.id == payload.branch_id).first():
        raise HTTPException(status_code=404, detail="Branch not found.")
    user.full_name = payload.full_name
    user.role = payload.role
    user.branch_id = payload.branch_id
    user.phone_number = payload.phone_number
    user.email_verified = payload.email_verified
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.get("/bookings")
def list_owner_bookings(
    page: int = 1,
    page_size: int = 50,
    branch_id: int | None = None,
    status_filter: str | None = None,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    query = _booking_query(db)
    if branch_id:
        query = query.filter(Booking.branch_id == branch_id)
    if status_filter:
        query = query.filter(Booking.status == status_filter)
    total = query.count()
    bookings = query.order_by(Booking.appointment_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"bookings": [_serialize_booking(item) for item in bookings], "total": total, "page": page, "page_size": page_size}


@router.get("/transactions")
def list_owner_transactions(
    page: int = 1,
    page_size: int = 50,
    branch_id: int | None = None,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    query = _transaction_query(db)
    if branch_id:
        query = query.join(Booking, Transaction.booking_id == Booking.id).filter(Booking.branch_id == branch_id)
    total = query.count()
    transactions = query.order_by(Transaction.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"transactions": [_serialize_transaction(item) for item in transactions], "total": total, "page": page, "page_size": page_size}


@router.get("/reports")
def get_owner_reports(
    period: str = Query("weekly", pattern="^(daily|weekly|monthly)$"),
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    start, end = _period_bounds(period, start_date, end_date)
    booking_query = db.query(Booking).filter(Booking.appointment_date >= start, Booking.appointment_date < end)
    transaction_query = db.query(Transaction).join(Booking, Transaction.booking_id == Booking.id).filter(
        Transaction.created_at >= start,
        Transaction.created_at < end,
    )
    if branch_id:
        booking_query = booking_query.filter(Booking.branch_id == branch_id)
        transaction_query = transaction_query.filter(Booking.branch_id == branch_id)

    branch_report_query = (
        db.query(
            Branch.name,
            func.count(Booking.id).label("bookings"),
            func.coalesce(func.sum(Transaction.amount), 0).label("sales"),
        )
        .join(Booking, Booking.branch_id == Branch.id)
        .outerjoin(Transaction, Transaction.booking_id == Booking.id)
        .filter(Booking.appointment_date >= start, Booking.appointment_date < end)
    )
    if branch_id:
        branch_report_query = branch_report_query.filter(Branch.id == branch_id)
    branch_rows = (
        branch_report_query
        .group_by(Branch.name)
        .order_by(func.coalesce(func.sum(Transaction.amount), 0).desc())
        .all()
    )

    service_rows = (
        db.query(Service.name, func.count(Booking.id).label("bookings"), func.coalesce(func.sum(Transaction.amount), 0).label("sales"))
        .join(Booking, Booking.service_id == Service.id)
        .outerjoin(Transaction, Transaction.booking_id == Booking.id)
        .filter(Booking.appointment_date >= start, Booking.appointment_date < end)
        .group_by(Service.name)
        .order_by(func.count(Booking.id).desc())
        .all()
    )

    return {
        "period": period,
        "start_date": start.date().isoformat(),
        "end_date": (end - timedelta(days=1)).date().isoformat(),
        "summary": {
            "bookings": booking_query.count(),
            "completed": booking_query.filter(Booking.status == "completed").count(),
            "pending": booking_query.filter(Booking.status == "pending").count(),
            "cancelled": booking_query.filter(Booking.status == "cancelled").count(),
            "sales": float(transaction_query.with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0),
        },
        "branches": [{"name": row.name, "bookings": row.bookings, "sales": float(row.sales or 0)} for row in branch_rows],
        "services": [{"name": row.name, "bookings": row.bookings, "sales": float(row.sales or 0)} for row in service_rows],
    }


@router.get("/forecasting")
def get_owner_forecasting(
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    window_start = datetime.combine(date.today() - timedelta(days=29), time.min)
    rows = (
        db.query(Branch.id, Branch.name, func.count(Booking.id).label("bookings"))
        .outerjoin(Booking, (Booking.branch_id == Branch.id) & (Booking.appointment_date >= window_start))
        .group_by(Branch.id, Branch.name)
        .order_by(Branch.name.asc())
        .all()
    )
    forecasts = []
    for branch_id, branch_name, bookings in rows:
        daily_average = float(bookings or 0) / 30
        forecast_volume = round(daily_average * 7, 1)
        if forecast_volume >= 25:
            demand_level = "high"
        elif forecast_volume >= 10:
            demand_level = "moderate"
        else:
            demand_level = "low"
        forecasts.append({
            "branch_id": branch_id,
            "branch": branch_name,
            "historical_bookings": bookings,
            "forecast_bookings": forecast_volume,
            "demand_level": demand_level,
            "method": "30-day rolling average fallback",
        })
    return {"forecasts": forecasts}


@router.get("/workforce")
def get_owner_workforce(
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    forecast_data = get_owner_forecasting(current_user=current_user, db=db)["forecasts"]
    recommendations = []
    for item in forecast_data:
        if item["demand_level"] == "high":
            action = "Assign additional staff during peak hours and prepare high-demand service materials."
            recommended_staff = 5
        elif item["demand_level"] == "moderate":
            action = "Maintain normal staffing and monitor weekend appointment load."
            recommended_staff = 3
        else:
            action = "Use lean staffing and prioritize flexible scheduling."
            recommended_staff = 2
        recommendations.append({**item, "recommended_staff": recommended_staff, "recommendation": action})
    return {"recommendations": recommendations}


@router.get("/audit-logs")
def get_owner_audit_logs(
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    events = []
    for user in db.query(User).order_by(User.created_at.desc()).limit(10).all():
        events.append({"type": "user", "action": f"{user.role.title()} account registered", "actor": user.full_name, "created_at": user.created_at})
    for booking in _booking_query(db).order_by(Booking.updated_at.desc()).limit(10).all():
        events.append({"type": "booking", "action": f"Booking marked {booking.status}", "actor": booking.customer.full_name if booking.customer else "Customer", "created_at": booking.updated_at or booking.created_at})
    for transaction in _transaction_query(db).order_by(Transaction.created_at.desc()).limit(10).all():
        events.append({"type": "transaction", "action": f"Payment recorded via {transaction.payment_method}", "actor": transaction.staff.full_name if transaction.staff else "Staff", "created_at": transaction.created_at})
    events.sort(key=lambda event: event["created_at"] or datetime.min, reverse=True)
    return {"audit_logs": events[:30]}
