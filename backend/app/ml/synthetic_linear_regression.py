"""Leakage-safe linear regression for synthetic branch/service daily data."""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


FEATURES = ["branch_id", "service_id", "day_of_week", "is_weekend", "month", "time_index", "lag_1", "lag_7", "rolling_mean_7"]


def features(frame: pd.DataFrame, time_origin=None) -> pd.DataFrame:
    result = frame.sort_values(["branch_id", "service_id", "date"]).copy()
    parsed = pd.to_datetime(result["date"])
    result["day_of_week"] = parsed.dt.dayofweek
    result["is_weekend"] = (parsed.dt.dayofweek >= 5).astype(int)
    result["month"] = parsed.dt.month
    first = pd.Timestamp(time_origin) if time_origin is not None else parsed.min()
    result["time_index"] = (parsed - first).dt.days
    groups = result.groupby(["branch_id", "service_id"], sort=False)["target"]
    result["lag_1"] = groups.shift(1)
    result["lag_7"] = groups.shift(7)
    result["rolling_mean_7"] = groups.transform(lambda values: values.shift(1).rolling(7, min_periods=7).mean())
    return result


def _estimator() -> Pipeline:
    categorical = ["branch_id", "service_id", "day_of_week", "month"]
    numeric = ["is_weekend", "time_index", "lag_1", "lag_7", "rolling_mean_7"]
    transform = ColumnTransformer([
        ("categorical", OneHotEncoder(handle_unknown="ignore"), categorical),
        ("numeric", StandardScaler(), numeric),
    ])
    return Pipeline([("features", transform), ("model", LinearRegression())])


def train_evaluate(frame: pd.DataFrame) -> tuple[Pipeline, dict[str, float | None]]:
    featured = features(frame).dropna(subset=FEATURES).copy()
    dates = sorted(featured["date"].unique())
    if len(dates) < 42:
        raise ValueError("At least 42 days are required for chronological train/test evaluation.")
    cutoff = dates[max(28, int(len(dates) * 0.8))]
    train = featured[featured["date"] < cutoff]
    test = featured[featured["date"] >= cutoff]
    if train.empty or test.empty:
        raise ValueError("Chronological train/test split is empty.")
    model = _estimator().fit(train[FEATURES], train["target"])
    prediction = np.clip(model.predict(test[FEATURES]), 0, None)
    actual = test["target"].to_numpy(dtype=float)
    baseline = np.clip(test["lag_7"].to_numpy(dtype=float), 0, None)
    metrics = {
        "mae": float(mean_absolute_error(actual, prediction)),
        "rmse": float(np.sqrt(mean_squared_error(actual, prediction))),
        "r2": float(r2_score(actual, prediction)) if len(actual) > 1 else None,
        "baseline_mae": float(mean_absolute_error(actual, baseline)),
        "baseline_rmse": float(np.sqrt(mean_squared_error(actual, baseline))),
        "train_rows": int(len(train)), "test_rows": int(len(test)),
        "split": "chronological 80/20 by date", "non_negative_constraint": "predictions clipped at zero",
    }
    return _estimator().fit(featured[FEATURES], featured["target"]), metrics


def recursive_forecast(frame: pd.DataFrame, model: Pipeline, horizon: int, branch_id: str | None = None, service_id: int | None = None) -> list[dict]:
    work = frame.copy().sort_values("date")
    latest = pd.to_datetime(work["date"]).max().date()
    time_origin = pd.to_datetime(work["date"]).min()
    if branch_id is not None: work = work[work["branch_id"] == branch_id]
    if service_id is not None: work = work[work["service_id"] == service_id]
    keys = sorted(set(zip(work["branch_id"], work["service_id"])))
    if branch_id is not None: keys = [key for key in keys if key[0] == branch_id]
    if service_id is not None: keys = [key for key in keys if key[1] == service_id]
    results = []
    for branch, service in keys:
        series = work[(work["branch_id"] == branch) & (work["service_id"] == service)].sort_values("date")
        history = series[["date", "branch_id", "service_id", "target"]].copy()
        history["date"] = pd.to_datetime(history["date"])
        history = history.tail(60)
        for offset in range(1, horizon + 1):
            day = latest + timedelta(days=offset)
            placeholder = pd.DataFrame([{"date": pd.Timestamp(day), "branch_id": branch, "service_id": service, "target": np.nan}])
            expanded = pd.concat([history, placeholder], ignore_index=True)
            row = features(expanded, time_origin=time_origin).iloc[-1]
            if row[FEATURES].isna().any(): predicted = 0.0
            else: predicted = max(0.0, float(model.predict(pd.DataFrame([row[FEATURES]]))[0]))
            results.append({"date": day.isoformat(), "branch_id": branch, "service_id": int(service), "predicted_daily_revenue": round(predicted, 2)})
            history = pd.concat([history, pd.DataFrame([{"date": pd.Timestamp(day), "branch_id": branch, "service_id": service, "target": predicted}])], ignore_index=True).tail(60)
    return results
