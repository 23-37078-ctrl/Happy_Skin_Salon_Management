from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.branch import Branch


BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")
VALID_BOOKING_STATUSES = {"pending", "confirmed", "completed", "cancelled"}


@dataclass(frozen=True)
class DataReadiness:
    status: str
    history_days: int
    completed_appointments: int
    nonzero_days: int
    branch_count: int
    reasons: list[str]

    @property
    def sufficient(self) -> bool:
        return self.status == "sufficient"


def _business_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=BUSINESS_TIMEZONE)
    return value.astimezone(BUSINESS_TIMEZONE).date()


def extract_daily_completed_demand(
    db: Session,
    branch_id: int | None = None,
    through_date: date | None = None,
) -> pd.DataFrame:
    """Return a gap-free branch/day series using only completed appointments.

    The current business day is excluded by default because it is not yet a
    closed observation. Customer identifiers are never loaded into the frame.
    """
    through_date = through_date or (datetime.now(BUSINESS_TIMEZONE).date() - timedelta(days=1))

    branch_query = db.query(Branch.id).filter(Branch.is_active.is_(True))
    if branch_id is not None:
        branch_query = branch_query.filter(Branch.id == branch_id)
    branch_ids = [row[0] for row in branch_query.order_by(Branch.id).all()]

    if not branch_ids:
        return pd.DataFrame(columns=["date", "branch_id", "demand"])

    rows = (
        db.query(Booking.branch_id, Booking.appointment_date)
        .filter(
            Booking.branch_id.in_(branch_ids),
            Booking.status == "completed",
            Booking.appointment_date.isnot(None),
        )
        .all()
    )

    observations = [
        {"branch_id": row.branch_id, "date": _business_date(row.appointment_date), "demand": 1}
        for row in rows
        if _business_date(row.appointment_date) <= through_date
    ]
    if not observations:
        return pd.DataFrame(columns=["date", "branch_id", "demand"])

    counts = (
        pd.DataFrame(observations)
        .groupby(["branch_id", "date"], as_index=False)["demand"]
        .sum()
    )
    start_date = counts["date"].min()
    calendar = pd.date_range(start=start_date, end=through_date, freq="D").date
    full_index = pd.MultiIndex.from_product(
        [branch_ids, calendar], names=["branch_id", "date"]
    )
    return (
        counts.set_index(["branch_id", "date"])
        .reindex(full_index, fill_value=0)
        .reset_index()
        .sort_values(["date", "branch_id"])
        .reset_index(drop=True)
    )


def assess_readiness(frame: pd.DataFrame) -> DataReadiness:
    if frame.empty:
        return DataReadiness("insufficient", 0, 0, 0, 0, ["No completed appointments are available."])

    history_days = (frame["date"].max() - frame["date"].min()).days + 1
    completed = int(frame["demand"].sum())
    nonzero_days = int((frame["demand"] > 0).sum())
    branch_count = int(frame["branch_id"].nunique())
    reasons: list[str] = []
    if history_days < 56:
        reasons.append(f"Only {history_days} calendar days are available; at least 56 are required.")
    if completed < 30:
        reasons.append(f"Only {completed} completed appointments are available; at least 30 are required.")
    if nonzero_days < 14:
        reasons.append(f"Demand occurs on only {nonzero_days} days; at least 14 non-zero days are required.")

    return DataReadiness(
        "sufficient" if not reasons else "insufficient",
        history_days,
        completed,
        nonzero_days,
        branch_count,
        reasons,
    )


def add_time_series_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Create leakage-safe features; all historical aggregates are shifted."""
    featured = frame.copy().sort_values(["branch_id", "date"])
    dates = pd.to_datetime(featured["date"])
    featured["day_of_week"] = dates.dt.dayofweek
    featured["month"] = dates.dt.month
    featured["week_of_year"] = dates.dt.isocalendar().week.astype(int)
    featured["is_weekend"] = (dates.dt.dayofweek >= 5).astype(int)

    groups = featured.groupby("branch_id", sort=False)["demand"]
    for lag in (1, 7, 14, 28):
        featured[f"lag_{lag}"] = groups.shift(lag)
    for window in (7, 28):
        featured[f"rolling_mean_{window}"] = groups.transform(
            lambda values: values.shift(1).rolling(window, min_periods=window).mean()
        )
    featured["rolling_trend_7"] = featured["rolling_mean_7"] - groups.transform(
        lambda values: values.shift(8).rolling(7, min_periods=7).mean()
    )
    return featured


FEATURE_COLUMNS = [
    "branch_id",
    "day_of_week",
    "month",
    "week_of_year",
    "is_weekend",
    "lag_1",
    "lag_7",
    "lag_14",
    "lag_28",
    "rolling_mean_7",
    "rolling_mean_28",
    "rolling_trend_7",
]

