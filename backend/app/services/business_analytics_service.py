from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.transaction import Transaction


BUSINESS_TIMEZONE = ZoneInfo("Asia/Manila")


def _local_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(BUSINESS_TIMEZONE).date()


def _utc_start(value: date) -> datetime:
    return datetime.combine(value, time.min, BUSINESS_TIMEZONE).astimezone(timezone.utc).replace(tzinfo=None)


def _next_month(value: date) -> date:
    return value.replace(year=value.year + (value.month == 12), month=1 if value.month == 12 else value.month + 1, day=1)


def build_business_history(db: Session, branch_ids: list[int] | None = None, days: int = 1095) -> dict:
    """Summarize real operational bookings and recorded transactions for up to three years."""
    today = datetime.now(BUSINESS_TIMEZONE).date()
    requested_start = today - timedelta(days=days - 1)
    end_exclusive = today + timedelta(days=1)
    start_utc, end_utc = _utc_start(requested_start), _utc_start(end_exclusive)

    booking_query = db.query(Booking).filter(Booking.appointment_date >= start_utc, Booking.appointment_date < end_utc)
    transaction_query = db.query(Transaction).join(Booking, Transaction.booking_id == Booking.id).filter(
        Transaction.created_at >= start_utc,
        Transaction.created_at < end_utc,
    )
    if branch_ids is not None:
        if not branch_ids:
            return _empty_history(requested_start, today)
        booking_query = booking_query.filter(Booking.branch_id.in_(branch_ids))
        transaction_query = transaction_query.filter(Booking.branch_id.in_(branch_ids))

    daily: dict[date, dict] = defaultdict(lambda: {
        "bookings": 0, "active_bookings": 0, "completed_bookings": 0, "cancelled_bookings": 0,
        "transactions": 0, "gross_sales": 0.0, "commissions": 0.0,
    })
    for booking in booking_query.all():
        day = _local_date(booking.appointment_date)
        if not requested_start <= day <= today:
            continue
        daily[day]["bookings"] += 1
        if booking.status == "cancelled":
            daily[day]["cancelled_bookings"] += 1
        else:
            daily[day]["active_bookings"] += 1
        if booking.status == "completed":
            daily[day]["completed_bookings"] += 1

    for transaction in transaction_query.all():
        day = _local_date(transaction.created_at)
        if not requested_start <= day <= today:
            continue
        row = daily[day]
        row["transactions"] += 1
        row["gross_sales"] += float(transaction.amount or 0)
        row["commissions"] += float(transaction.commission_amount or 0)

    monthly: dict[str, dict] = defaultdict(lambda: {
        "bookings": 0, "completed_bookings": 0, "cancelled_bookings": 0,
        "transactions": 0, "gross_sales": 0.0, "salon_sales": 0.0, "commissions": 0.0,
    })
    for day, row in daily.items():
        month = day.strftime("%Y-%m")
        for key in ("bookings", "completed_bookings", "cancelled_bookings", "transactions", "gross_sales", "commissions"):
            monthly[month][key] += row[key]
        monthly[month]["salon_sales"] += max(0.0, row["gross_sales"] - row["commissions"])

    transaction_days = [day for day, row in daily.items() if row["transactions"] > 0]
    booking_days = [day for day, row in daily.items() if row["bookings"] > 0 or row["completed_bookings"] > 0 or row["cancelled_bookings"] > 0]
    observed_days = transaction_days + booking_days
    first_history_date = min(observed_days) if observed_days else None
    monthly_rows = []
    month = first_history_date.replace(day=1) if first_history_date else today.replace(day=1)
    while first_history_date and month <= today:
        row = monthly[month.strftime("%Y-%m")]
        monthly_rows.append({
            "month": month.strftime("%Y-%m"),
            **{key: int(row[key]) for key in ("bookings", "completed_bookings", "cancelled_bookings", "transactions")},
            **{key: round(row[key], 2) for key in ("gross_sales", "salon_sales", "commissions")},
        })
        month = _next_month(month)

    today_row = daily[today]
    last_complete_day = today - timedelta(days=1)
    daily_observations = {
        first_history_date + timedelta(days=offset): daily[first_history_date + timedelta(days=offset)]
        for offset in range(max(0, (last_complete_day - first_history_date).days + 1))
    } if first_history_date else {}
    forecasts = []
    for offset in range(1, 8) if first_history_date else []:
        forecast_day = today + timedelta(days=offset)
        recent_samples = [row for day, row in daily_observations.items() if day.weekday() == forecast_day.weekday() and day >= forecast_day - timedelta(days=84)]
        if not recent_samples:
            recent_samples = [row for day, row in daily_observations.items() if day >= forecast_day - timedelta(days=28)]
        seasonal_days: set[date] = set()
        for year_offset in (1, 2, 3):
            try:
                anniversary = forecast_day.replace(year=forecast_day.year - year_offset)
            except ValueError:
                anniversary = forecast_day.replace(year=forecast_day.year - year_offset, month=2, day=28)
            seasonal_days.update(
                day for day in daily_observations
                if abs((day - anniversary).days) <= 3 and day.weekday() == forecast_day.weekday()
            )
        seasonal_samples = [daily_observations[day] for day in sorted(seasonal_days)]
        if not recent_samples and not seasonal_samples:
            continue
        def average(key: str) -> float:
            recent_average = sum(row[key] for row in recent_samples) / len(recent_samples) if recent_samples else None
            seasonal_average = sum(row[key] for row in seasonal_samples) / len(seasonal_samples) if seasonal_samples else None
            if recent_average is not None and seasonal_average is not None:
                value = recent_average * 0.7 + seasonal_average * 0.3
            else:
                value = recent_average if recent_average is not None else seasonal_average or 0.0
            return round(value, 1)
        forecasts.append({
            "date": forecast_day,
            "predicted_bookings": average("active_bookings"),
            "predicted_completed_bookings": average("completed_bookings"),
            "predicted_transactions": average("transactions"),
            "predicted_gross_sales": average("gross_sales"),
            "predicted_salon_sales": round(max(0.0, average("gross_sales") - average("commissions")), 2),
            "sample_days": len(recent_samples),
            "seasonal_sample_days": len(seasonal_samples),
        })

    return {
        "timezone": "Asia/Manila",
        "range_start": requested_start,
        "range_end": today,
        "history_start": first_history_date,
        "history_end": max(observed_days) if observed_days else None,
        "actual_transaction_days": len(transaction_days),
        "actual_booking_days": len(booking_days),
        "today": {
            "bookings": today_row["bookings"],
            "completed_bookings": today_row["completed_bookings"],
            "cancelled_bookings": today_row["cancelled_bookings"],
            "transactions": today_row["transactions"],
            "gross_sales": round(today_row["gross_sales"], 2),
            "salon_sales": round(max(0.0, today_row["gross_sales"] - today_row["commissions"]), 2),
            "commissions": round(today_row["commissions"], 2),
        },
        "monthly": monthly_rows,
        "sales_forecast": forecasts,
        "forecast_method": "Blends recent same-weekday results with same-season records from the previous three years when available; uses recorded operational data only.",
    }


def _empty_history(start: date, end: date) -> dict:
    return {"timezone": "Asia/Manila", "range_start": start, "range_end": end, "history_start": None, "history_end": None, "actual_transaction_days": 0, "actual_booking_days": 0, "today": {"bookings": 0, "completed_bookings": 0, "cancelled_bookings": 0, "transactions": 0, "gross_sales": 0, "salon_sales": 0, "commissions": 0}, "monthly": [], "sales_forecast": [], "forecast_method": "No actual transaction or booking history is available for this branch."}
