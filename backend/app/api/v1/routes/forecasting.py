from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.permissions import require_role
from app.models.model_registry import ModelRegistry
from app.models.user import User
from app.schemas.forecast import BranchForecastResponse, ModelAccuracyResponse, TrainingResponse
from app.services.forecast_service import InsufficientForecastData, build_branch_forecast, train_forecast_model


router = APIRouter(prefix="/forecast", tags=["Forecasting"])


def _authorize_branch(user: User, branch_id: int) -> None:
    if user.role == "owner":
        return
    if user.role == "manager" and user.branch_id == branch_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access forecasting for this branch.")


@router.get("/branches/{branch_id}", response_model=BranchForecastResponse)
def get_branch_forecast(
    branch_id: int,
    horizon: int = Query(default=7, ge=1, le=14),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
