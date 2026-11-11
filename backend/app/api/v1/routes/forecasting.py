from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.permissions import require_role
from app.models.model_registry import ModelRegistry
from app.models.branch import Branch
from app.models.user import User
from app.schemas.forecast import BranchForecastResponse, ModelAccuracyResponse, TrainingResponse
from app.services.business_analytics_service import build_business_history
from app.services.forecast_service import InsufficientForecastData, build_branch_forecast, train_forecast_model


router = APIRouter(prefix="/forecast", tags=["Forecasting"])


@router.get("/business-history")
def get_business_history(
    days: int = Query(default=1095, ge=1, le=1095),
    branch_id: int | None = Query(default=None, ge=1),
    current_user: User = Depends(require_role("owner", "manager", "staff")),
    db: Session = Depends(get_db),
):
    """Return actual, branch-scoped booking and transaction history plus a short outlook."""
    if current_user.role == "owner":
        branches = db.query(Branch).order_by(Branch.name).all()
        if branch_id is not None and not any(branch.id == branch_id for branch in branches):
            raise HTTPException(status_code=404, detail="Branch not found.")
        branch_ids = [branch_id] if branch_id is not None else [branch.id for branch in branches]
        visible_branches = [branch for branch in branches if branch_id is None or branch.id == branch_id]
    else:
        if current_user.branch_id is None:
            raise HTTPException(status_code=403, detail="Your account is not assigned to a branch.")
        if branch_id is not None and branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="You can only view your assigned branch.")
        branch_ids = [current_user.branch_id]
        visible_branches = db.query(Branch).filter(Branch.id == current_user.branch_id).all()
    result = build_business_history(db, branch_ids=branch_ids, days=days)
    result["branch_id"] = branch_ids[0] if len(branch_ids) == 1 else None
    result["branch_name"] = visible_branches[0].name if len(visible_branches) == 1 else "All branches"
    result["branches"] = [{"id": branch.id, "name": branch.name} for branch in visible_branches]
    return result


def _authorize_branch(user: User, branch_id: int) -> None:
    if user.role == "owner":
        return
    if user.role == "manager" and user.branch_id == branch_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access forecasting for this branch.")


@router.get("/branches/{branch_id}", response_model=BranchForecastResponse)
def get_branch_forecast(
    branch_id: int,
    horizon: int = Query(default=7, ge=1, le=365),
    current_user: User = Depends(require_role("owner", "manager")),
    db: Session = Depends(get_db),
):
    _authorize_branch(current_user, branch_id)
    try:
        return build_branch_forecast(db, branch_id=branch_id, horizon=horizon)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/branches/{branch_id}/recommendations")
def get_branch_recommendations(
    branch_id: int,
    current_user: User = Depends(require_role("owner", "manager")),
    db: Session = Depends(get_db),
):
    _authorize_branch(current_user, branch_id)
    try:
        forecast = build_branch_forecast(db, branch_id=branch_id, horizon=7)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "branch_id": branch_id,
        "data_quality": forecast["data_quality"],
        "recommendations": [
            {
                "date": point["date"],
                "demand_level": point["demand_level"],
                "message": point["recommendation"],
            }
            for point in forecast["predictions"]
        ],
    }


@router.get("/accuracy", response_model=ModelAccuracyResponse)
def get_model_accuracy(
    current_user: User = Depends(require_role("owner", "manager")),
    db: Session = Depends(get_db),
):
    registry = (
        db.query(ModelRegistry)
        .filter(ModelRegistry.active.is_(True))
        .order_by(ModelRegistry.trained_at.desc())
        .first()
    )
    if not registry:
        raise HTTPException(status_code=404, detail="No validated forecasting model is available.")
    return {
        "model": registry.algorithm,
        "version": registry.version,
        "trained_at": registry.trained_at,
        "training_period": f"{registry.training_start_date} to {registry.training_end_date}",
        "training_rows": registry.training_rows,
        "metrics": registry.metrics,
    }


@router.post("/train", response_model=TrainingResponse)
def train_model(
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    try:
        registry = train_forecast_model(db)
    except InsufficientForecastData as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Training refused because historical data is insufficient.",
                "history_days": exc.readiness.history_days,
                "completed_appointments": exc.readiness.completed_appointments,
                "nonzero_days": exc.readiness.nonzero_days,
                "reasons": exc.readiness.reasons,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {
        "message": "Forecasting model trained and activated.",
        "model": registry.algorithm,
        "version": registry.version,
        "metrics": registry.metrics,
        "training_rows": registry.training_rows,
    }
