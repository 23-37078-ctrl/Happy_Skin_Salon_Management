from datetime import date, timedelta

import pandas as pd

from app.ml.synthetic_linear_regression import FEATURES, features
from scripts.synthetic_dataset import validate


def test_daily_validation_rejects_duplicate_combinations():
    record = {"date": "2023-10-15", "branch_id": "BR001", "service_id": 1}
    report = validate({"branches": [{"branch_id": "BR001"}], "services": [{"service_id": 1}], "daily": [record, record]}, {})
    assert not report["valid"]
    assert any("duplicate daily forecast key" in item for item in report["errors"])


def test_lags_and_rolling_values_use_only_past_targets():
    start = date(2024, 1, 1)
    frame = pd.DataFrame([{
        "date": start + timedelta(days=offset), "branch_id": "BR001", "service_id": 1, "target": float(offset)
    } for offset in range(12)])
    featured = features(frame)
    row = featured.iloc[8]
    assert row["lag_1"] == 7
    assert row["lag_7"] == 1
    assert row["rolling_mean_7"] == 4
    assert set(FEATURES).issubset(featured.columns)
