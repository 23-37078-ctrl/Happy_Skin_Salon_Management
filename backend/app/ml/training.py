from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.evaluation import regression_metrics
from app.ml.preprocessing import FEATURE_COLUMNS, add_time_series_features


@dataclass
class TrainedCandidate:
    name: str
    model: object | None
    metrics: dict[str, float | None]


def _model_candidates() -> dict[str, object]:
    numeric = [column for column in FEATURE_COLUMNS if column != "branch_id"]
    ridge = Pipeline([
        ("features", ColumnTransformer([
            ("branch", OneHotEncoder(handle_unknown="ignore"), ["branch_id"]),
            ("numeric", StandardScaler(), numeric),
        ])),
        ("model", Ridge(alpha=1.0)),
    ])
    return {
        "ridge": ridge,
        "random_forest": RandomForestRegressor(
            n_estimators=200, min_samples_leaf=2, random_state=42, n_jobs=-1
        ),
        "hist_gradient_boosting": HistGradientBoostingRegressor(
            max_iter=200, learning_rate=0.05, max_leaf_nodes=15, random_state=42
        ),
    }


def train_and_compare(daily_frame: pd.DataFrame) -> TrainedCandidate:
    featured = add_time_series_features(daily_frame).dropna(subset=FEATURE_COLUMNS).copy()
    unique_dates = sorted(featured["date"].unique())
    if len(unique_dates) < 28:
        raise ValueError("At least 28 feature-complete dates are required for validation.")

    fold_size = max(7, len(unique_dates) // 5)
    cutoffs = [len(unique_dates) - fold_size * factor for factor in (3, 2, 1)]
    cutoffs = [cutoff for cutoff in cutoffs if cutoff >= 28]
    if not cutoffs:
        raise ValueError("Not enough chronological folds are available.")

    candidates: list[TrainedCandidate] = []
    baseline_actual: list[float] = []
    baseline_predicted: list[float] = []
    for cutoff in cutoffs:
        validation_dates = unique_dates[cutoff : min(cutoff + fold_size, len(unique_dates))]
        validation = featured[featured["date"].isin(validation_dates)]
        baseline_actual.extend(validation["demand"].tolist())
        baseline_predicted.extend(validation["lag_7"].tolist())
    candidates.append(TrainedCandidate("seasonal_naive_7", None, regression_metrics(baseline_actual, baseline_predicted)))

    for name, estimator in _model_candidates().items():
        actual: list[float] = []
        predicted: list[float] = []
        for cutoff in cutoffs:
            train_dates = unique_dates[:cutoff]
            validation_dates = unique_dates[cutoff : min(cutoff + fold_size, len(unique_dates))]
            train = featured[featured["date"].isin(train_dates)]
            validation = featured[featured["date"].isin(validation_dates)]
            estimator.fit(train[FEATURE_COLUMNS], train["demand"])
            actual.extend(validation["demand"].tolist())
            predicted.extend(np.clip(estimator.predict(validation[FEATURE_COLUMNS]), 0, None).tolist())
        metrics = regression_metrics(actual, predicted)
        estimator.fit(featured[FEATURE_COLUMNS], featured["demand"])
        candidates.append(TrainedCandidate(name, estimator, metrics))

    return min(candidates, key=lambda candidate: (candidate.metrics["mae"], candidate.metrics["rmse"]))

