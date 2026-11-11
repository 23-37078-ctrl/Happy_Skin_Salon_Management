from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import joblib
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ml.preprocessing import (
    FEATURE_COLUMNS,
    DataReadiness,
    add_time_series_features,
    assess_readiness,
    extract_daily_completed_demand,
)
from app.ml.recommendations import demand_level, recommendation_for
from app.models.branch import Branch
from app.models.forecast_result import ForecastResult
from app.models.model_registry import ModelRegistry
from app.models.booking import Booking, BookingServiceItem
from app.models.service import Service
from app.models.user import User


BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")
BACKEND_DIR = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = BACKEND_DIR / "ml" / "models"


class InsufficientForecastData(ValueError):
    def __init__(self, readiness: DataReadiness):
        self.readiness = readiness
        super().__init__(" ".join(readiness.reasons))


def _active_model(db: Session) -> ModelRegistry | None:
    return (
        db.query(ModelRegistry)
        .filter(ModelRegistry.active.is_(True))
        .order_by(ModelRegistry.trained_at.desc())
        .first()
    )


def _predict_future(
    branch_frame: pd.DataFrame,
    horizon: int,
    registry: ModelRegistry | None,
) -> tuple[str, str | None, list[tuple[date, float]]]:
    start_date = datetime.now(BUSINESS_TIMEZONE).date() + timedelta(days=1)
    working = branch_frame.copy().sort_values("date")
    predictions: list[tuple[date, float]] = []
    used_fallback = False
    estimator = None
    if registry and registry.artifact_path:
        artifact = BACKEND_DIR / registry.artifact_path
        if artifact.exists():
            estimator = joblib.load(artifact)

    for offset in range(horizon):
        forecast_date = start_date + timedelta(days=offset)
        placeholder = pd.DataFrame([{
            "date": forecast_date,
            "branch_id": int(working["branch_id"].iloc[-1]),
            "demand": float("nan"),
        }])
        working = pd.concat([working, placeholder], ignore_index=True)
        featured = add_time_series_features(working)
        row = featured.iloc[-1]

        if estimator is not None and not row[FEATURE_COLUMNS].isna().any():
            model_prediction = float(estimator.predict(pd.DataFrame([row[FEATURE_COLUMNS]]))[0])
            # A negative (or non-finite) appointment count is not operationally
            # meaningful. Use the recent observed mean instead of clipping it to
            # zero, which otherwise feeds zero back into the recursive forecast.
            if not math.isfinite(model_prediction) or model_prediction <= 0:
                recent = working.iloc[:-1]["demand"].tail(28).dropna()
                predicted = float(recent.mean()) if not recent.empty else 0.0
                used_fallback = True
            else:
                predicted = model_prediction
        else:
            recent = working.iloc[:-1]["demand"].tail(28).dropna()
            predicted = float(recent.mean()) if not recent.empty else 0.0
            used_fallback = True

        predicted = round(max(0.0, predicted), 1)
        working.loc[working.index[-1], "demand"] = predicted
        predictions.append((forecast_date, predicted))

    if registry and estimator is not None:
        model_name = f"{registry.algorithm} with 28-day fallback" if used_fallback else registry.algorithm
        return model_name, registry.version, predictions
    return "28-day moving average fallback", None, predictions


def build_branch_forecast(db: Session, branch_id: int, horizon: int = 7) -> dict:
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.is_active.is_(True)).first()
    if not branch:
        raise LookupError("Branch not found or inactive.")

    frame = extract_daily_completed_demand(db, branch_id=branch_id)
    readiness = assess_readiness(frame)
    registry = _active_model(db) if readiness.sufficient else None
    if frame.empty:
        today = datetime.now(BUSINESS_TIMEZONE).date()
        frame = pd.DataFrame([{"date": today - timedelta(days=1), "branch_id": branch_id, "demand": 0}])

    branch_frame = frame[frame["branch_id"] == branch_id].copy()
    model_name, model_version, values = _predict_future(branch_frame, horizon, registry)
    recent_average = float(branch_frame["demand"].tail(28).mean()) if not branch_frame.empty else 0.0
    service_rows = (
        db.query(Service.id, Service.name, Service.duration_minutes, func.count(BookingServiceItem.id))
        .select_from(BookingServiceItem)
        .join(Booking, Booking.id == BookingServiceItem.booking_id)
        .join(Service, Service.id == BookingServiceItem.service_id)
        .filter(
            Booking.branch_id == branch_id,
            Booking.status == "completed",
            Booking.appointment_date >= datetime.now(BUSINESS_TIMEZONE) - timedelta(days=90),
        )
        .group_by(Service.id, Service.name, Service.duration_minutes)
        .all()
    )
    if not service_rows:
        service_rows = (
            db.query(Service.id, Service.name, Service.duration_minutes, func.count(Booking.id))
            .join(Service, Service.id == Booking.service_id)
            .filter(
                Booking.branch_id == branch_id,
                Booking.status == "completed",
                Booking.appointment_date >= datetime.now(BUSINESS_TIMEZONE) - timedelta(days=90),
            )
            .group_by(Service.id, Service.name, Service.duration_minutes)
            .all()
        )
    total_service_bookings = sum(int(row[3]) for row in service_rows)
    service_mix = [
        {"service_id": row[0], "service_name": row[1], "duration_minutes": int(row[2] or 60), "share": int(row[3]) / total_service_bookings}
        for row in service_rows
    ] if total_service_bookings else []
    active_staff_count = db.query(User.id).filter(
        User.branch_id == branch_id, User.role == "staff", User.is_active.is_(True)
    ).count()
    predictions = []
    for forecast_date, predicted in values:
        level = demand_level(predicted, recent_average)
        service_capacity = []
        estimated_service_minutes = 0.0
        for service in service_mix:
            expected_bookings = round(predicted * service["share"], 1)
            estimated_service_minutes += expected_bookings * service["duration_minutes"]
            service_capacity.append({
                "service_id": service["service_id"],
                "service_name": service["service_name"],
                "expected_bookings": expected_bookings,
                "suggested_slots": int(math.ceil(expected_bookings * 1.2)),
                "duration_minutes": service["duration_minutes"],
            })
        recommended_staff = int(math.ceil(estimated_service_minutes / 360)) if estimated_service_minutes else 0
        staffing_gap = max(0, recommended_staff - active_staff_count)
        if service_capacity:
            if staffing_gap:
                plan = f"Plan for about {recommended_staff} staff ({staffing_gap} more than the {active_staff_count} active staff on record); prioritize capacity for the listed services. Confirm schedules and qualifications."
            else:
                plan = f"About {recommended_staff} staff-hours coverage units should meet estimated service time; prepare the listed service slots and confirm staff schedules."
        else:
            plan = "Service-level history is not available yet; review confirmed bookings and staff schedules manually."
        predictions.append({
            "date": forecast_date,
            "predicted_demand": predicted,
            "lower_bound": None,
            "upper_bound": None,
            "demand_level": level,
            "recommendation": f"{recommendation_for(level)} {plan}",
            "active_staff_count": active_staff_count,
            "recommended_staff_count": recommended_staff,
            "staffing_gap": staffing_gap,
            "service_capacity": service_capacity,
        })

    start = values[0][0]
    end = values[-1][0]
    limitation = None
    if not readiness.sufficient:
        limitation = "Historical data is insufficient for validated ML forecasting. Values use a descriptive moving-average fallback."

    return {
        "branch_id": branch.id,
        "branch_name": branch.name,
        "forecast_period": f"{start.isoformat()} to {end.isoformat()}",
        "horizon_days": horizon,
        "model": model_name,
        "model_version": model_version,
        "generated_at": datetime.now(BUSINESS_TIMEZONE),
        "data_quality": readiness.status,
        "data_source": "operational",
        "limitation": limitation,
        "readiness": {
            "status": readiness.status,
            "history_days": readiness.history_days,
            "completed_appointments": readiness.completed_appointments,
            "nonzero_days": readiness.nonzero_days,
            "reasons": readiness.reasons,
        },
        "historical": [
            {"date": row.date, "actual_demand": int(row.demand)}
            for row in branch_frame.tail(28).itertuples()
        ],
        "predictions": predictions,
    }


def train_forecast_model(db: Session) -> ModelRegistry:
    from app.ml.training import train_and_compare

    frame = extract_daily_completed_demand(db)
    readiness = assess_readiness(frame)
    if not readiness.sufficient:
        raise InsufficientForecastData(readiness)

    candidate = train_and_compare(frame)
    version = datetime.now(BUSINESS_TIMEZONE).strftime("demand-%Y%m%d-%H%M%S")
    artifact_path = None
    checksum = None
    if candidate.model is not None:
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        artifact = ARTIFACT_DIR / f"{version}.joblib"
        joblib.dump(candidate.model, artifact)
        checksum = hashlib.sha256(artifact.read_bytes()).hexdigest()
        artifact_path = str(artifact.relative_to(BACKEND_DIR)).replace("\\", "/")

    db.query(ModelRegistry).filter(ModelRegistry.active.is_(True)).update({"active": False})
    registry = ModelRegistry(
        model_name="daily_completed_appointments",
        algorithm=candidate.name,
        version=version,
        training_start_date=frame["date"].min(),
        training_end_date=frame["date"].max(),
        metrics=candidate.metrics,
        feature_config={"features": FEATURE_COLUMNS, "timezone": "Asia/Manila", "target": "daily_completed_appointments"},
        artifact_path=artifact_path,
        artifact_checksum=checksum,
        training_rows=len(frame),
        active=True,
    )
    db.add(registry)
    db.commit()
    db.refresh(registry)

    branch_ids = [row[0] for row in db.query(Branch.id).filter(Branch.is_active.is_(True)).all()]
    for branch_id in branch_ids:
        forecast = build_branch_forecast(db, branch_id=branch_id, horizon=7)
        for point in forecast["predictions"]:
            db.add(ForecastResult(
                branch_id=branch_id,
                model_registry_id=registry.id,
                forecast_date=point["date"],
                predicted_value=point["predicted_demand"],
                lower_bound=point["lower_bound"],
                upper_bound=point["upper_bound"],
                demand_level=point["demand_level"],
                data_quality=forecast["data_quality"],
            ))
    db.commit()
    return registry
