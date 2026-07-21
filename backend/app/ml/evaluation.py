from __future__ import annotations

import math

import numpy as np


def regression_metrics(actual, predicted) -> dict[str, float | None]:
    actual_values = np.asarray(actual, dtype=float)
    predicted_values = np.clip(np.asarray(predicted, dtype=float), 0, None)
    errors = actual_values - predicted_values
    mae = float(np.mean(np.abs(errors)))
    rmse = float(math.sqrt(np.mean(np.square(errors))))
    denominator = float(np.sum(np.abs(actual_values)))
    wape = float(np.sum(np.abs(errors)) / denominator * 100) if denominator else None
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "wape": round(wape, 2) if wape is not None else None}

