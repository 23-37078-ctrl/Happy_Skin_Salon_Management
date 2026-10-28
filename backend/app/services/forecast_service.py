from __future__ import annotations

import hashlib
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
from app.models.synthetic_dataset import SyntheticBranch, SyntheticDailyForecast, SyntheticImportBatch


BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")
BACKEND_DIR = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = BACKEND_DIR / "ml" / "models"
_SYNTHETIC_BRANCH_MODELS: dict[tuple[int, str], tuple[object, dict]] = {}


class InsufficientForecastData(ValueError):
    def __init__(self, readiness: DataReadiness):
        self.readiness = readiness
        super().__init__(" ".join(readiness.reasons))


def _build_synthetic_branch_forecast(db: Session, branch: Branch, horizon: int) -> dict | None:
    """Use generated CSV transactions as training history when live history is sparse."""
    batch = db.query(SyntheticImportBatch).order_by(SyntheticImportBatch.imported_at.desc()).first()
    if not batch:
        return None
    normalized_branch_name = " ".join(branch.name.casefold().split())
    synthetic_branch = next((
        row for row in db.query(SyntheticBranch).filter(SyntheticBranch.batch_id == batch.id).all()
        if " ".join(row.name.casefold().split()) == normalized_branch_name
    ), None)
    if not synthetic_branch:
        return None

    rows = db.query(
        SyntheticDailyForecast.forecast_date,
        func.sum(SyntheticDailyForecast.completed_bookings).label("completed_bookings"),
    ).filter(
        SyntheticDailyForecast.batch_id == batch.id,
        SyntheticDailyForecast.branch_id == synthetic_branch.synthetic_id,
    ).group_by(SyntheticDailyForecast.forecast_date).order_by(SyntheticDailyForecast.forecast_date).all()
    if len(rows) < 42:
        return None

    frame = pd.DataFrame.from_records(rows, columns=["date", "target"])
    frame["branch_id"] = str(branch.id)
    frame["service_id"] = 0
    frame["target"] = frame["target"].astype(float)
    cache_key = (batch.id, synthetic_branch.synthetic_id)
    cached = _SYNTHETIC_BRANCH_MODELS.get(cache_key)
    if cached is None:
        from app.ml.synthetic_linear_regression import recursive_forecast, train_evaluate

        model, metrics = train_evaluate(frame[["date", "branch_id", "service_id", "target"]])
        _SYNTHETIC_BRANCH_MODELS[cache_key] = (model, metrics)
    else:
        model, metrics = cached

    from app.ml.synthetic_linear_regression import recursive_forecast

    raw_predictions = recursive_forecast(
        frame[["date", "branch_id", "service_id", "target"]],
        model,
        horizon,
    )
    recent_average = float(frame["target"].tail(28).mean())
    predictions = []
    for point in raw_predictions:
        predicted = max(0, round(point["predicted_daily_revenue"]))
        level = demand_level(predicted, recent_average)
        predictions.append({
            "date": date.fromisoformat(point["date"]),
            "predicted_demand": predicted,
            "lower_bound": None,
            "upper_bound": None,
            "demand_level": level,
            "recommendation": recommendation_for(level),
        })

    start = predictions[0]["date"]
    end = predictions[-1]["date"]
    history = [
        {"date": row.date, "actual_demand": int(row.target)}
        for row in frame.tail(28).itertuples(index=False)
    ]
    return {
        "branch_id": branch.id,
        "branch_name": branch.name,
        "forecast_period": f"{start.isoformat()} to {end.isoformat()}",
        "horizon_days": horizon,
        "model": "Linear Regression · sample transaction history",
        "model_version": f"synthetic-batch-{batch.id}",
        "generated_at": datetime.now(BUSINESS_TIMEZONE),
        "data_quality": "synthetic_sample",
        "data_source": "synthetic_csv",
        "limitation": "Uses generated sample transactions from the 3-year CSV, not actual salon sales. Treat this forecast as a demonstration until real transaction history is available.",
        "readiness": {
            "status": "synthetic_sample",
            "history_days": len(frame),
            "completed_appointments": int(frame["target"].sum()),
            "nonzero_days": int((frame["target"] > 0).sum()),
            "reasons": ["Generated sample transaction data is being used."],
            "mae": metrics["mae"],
        },
        "historical": history,
        "predictions": predictions,
    }


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

        if registry and registry.algorithm == "seasonal_naive_7" and pd.notna(row.get("lag_7")):
            predicted = float(row["lag_7"])
        elif estimator is not None and not row[FEATURE_COLUMNS].isna().any():
            predicted = float(estimator.predict(pd.DataFrame([row[FEATURE_COLUMNS]]))[0])
        else:
            recent = working.iloc[:-1]["demand"].tail(28).dropna()
            predicted = float(recent.mean()) if not recent.empty else 0.0

        predicted = round(max(0.0, predicted), 1)
        working.loc[working.index[-1], "demand"] = predicted
        predictions.append((forecast_date, predicted))

    if registry and (registry.algorithm == "seasonal_naive_7" or estimator is not None):
        return registry.algorithm, registry.version, predictions
    return "28-day moving average fallback", None, predictions


def build_branch_forecast(db: Session, branch_id: int, horizon: int = 7) -> dict:
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.is_active.is_(True)).first()
    if not branch:
        raise LookupError("Branch not found or inactive.")

    frame = extract_daily_completed_demand(db, branch_id=branch_id)
    readiness = assess_readiness(frame)
    if not readiness.sufficient:
        synthetic_forecast = _build_synthetic_branch_forecast(db, branch, horizon)
        if synthetic_forecast is not None:
            return synthetic_forecast
    registry = _active_model(db) if readiness.sufficient else None
    if frame.empty:
        today = datetime.now(BUSINESS_TIMEZONE).date()
        frame = pd.DataFrame([{"date": today - timedelta(days=1), "branch_id": branch_id, "demand": 0}])

    branch_frame = frame[frame["branch_id"] == branch_id].copy()
    model_name, model_version, values = _predict_future(branch_frame, horizon, registry)
    recent_average = float(branch_frame["demand"].tail(28).mean()) if not branch_frame.empty else 0.0
    predictions = []
    for forecast_date, predicted in values:
        level = demand_level(predicted, recent_average)
        predictions.append({
            "date": forecast_date,
            "predicted_demand": predicted,
            "lower_bound": None,
            "upper_bound": None,
            "demand_level": level,
            "recommendation": recommendation_for(level),
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
