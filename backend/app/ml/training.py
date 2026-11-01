from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.evaluation import regression_metrics
from app.ml.preprocessing import FEATURE_COLUMNS, add_time_series_features


@dataclass
class TrainedCandidate:
    name: str
    model: object
    metrics: dict[str, float | None]


def _linear_regression() -> Pipeline:
    """Build a linear regression model with encoded branch and scaled features."""
    numeric = [column for column in FEATURE_COLUMNS if column != "branch_id"]
    return Pipeline([
        ("features", ColumnTransformer([
            ("branch", OneHotEncoder(handle_unknown="ignore"), ["branch_id"]),
            ("numeric", StandardScaler(), numeric),
        ])),
        ("model", LinearRegression()),
    ])


def train_and_compare(daily_frame: pd.DataFrame) -> TrainedCandidate:
    """Validate linear regression chronologically, then fit it on all history."""
    featured = add_time_series_features(daily_frame).dropna(subset=FEATURE_COLUMNS).copy()
    unique_dates = sorted(featured["date"].unique())
    if len(unique_dates) < 28:
        raise ValueError("At least 28 feature-complete dates are required for validation.")

    fold_size = max(7, len(unique_dates) // 5)
    cutoffs = [len(unique_dates) - fold_size * factor for factor in (3, 2, 1)]
    cutoffs = [cutoff for cutoff in cutoffs if cutoff >= 28]
    if not cutoffs:
        raise ValueError("Not enough chronological folds are available.")

    actual: list[float] = []
    predicted: list[float] = []
    estimator = _linear_regression()
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
    return TrainedCandidate("linear_regression", estimator, metrics)
