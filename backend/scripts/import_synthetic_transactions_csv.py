"""Validate and optionally stage the synthetic transaction CSV for forecasting.

The import writes only to synthetic_* tables. It never modifies operational
users, bookings, services, or transactions. Default behavior is a dry run.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_transaction_csv import BRANCHES, END_DATE, SERVICES, START_DATE  # noqa: E402


EXPECTED_ORIGIN = "SYNTHETIC_SAMPLE_NOT_REAL_TRANSACTION"
REQUIRED_COLUMNS = {
    "transaction_id", "booking_id", "transaction_datetime", "branch_name",
    "client_name", "service_name", "service_provider", "encoded_by",
    "payment_method", "subtotal_php", "discount_php", "sale_php",
    "commission_rate_percent", "commission_php", "status", "data_origin",
}
BRANCH_IDS = {name: f"BR00{index}" for index, name in enumerate(BRANCHES, start=1)}
SERVICE_IDS = {name: index for index, (name, _) in enumerate(SERVICES, start=1)}


def read_and_validate(path: Path):
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    daily = defaultdict(lambda: {"transactions": 0, "revenue": 0.0})
    transactions = []
    transaction_ids = set()
    min_date = None
    max_date = None
    with path.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")
        for line_number, row in enumerate(reader, start=2):
            if row["data_origin"] != EXPECTED_ORIGIN:
                raise ValueError(f"Line {line_number}: row is not labeled as synthetic data.")
            if row["status"].strip().lower() != "completed":
                raise ValueError(f"Line {line_number}: only completed sample transactions can be used.")
            if row["branch_name"] not in BRANCH_IDS or row["service_name"] not in SERVICE_IDS:
                raise ValueError(f"Line {line_number}: unknown branch or service.")
            transaction_id = row["transaction_id"].strip()
            if not transaction_id or transaction_id in transaction_ids:
                raise ValueError(f"Line {line_number}: transaction ID is blank or duplicated.")
            transaction_ids.add(transaction_id)
            try:
                timestamp = datetime.fromisoformat(row["transaction_datetime"])
                subtotal = float(row["subtotal_php"])
                discount = float(row["discount_php"])
                sale = float(row["sale_php"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Line {line_number}: invalid date or transaction amount.") from exc
            if min(subtotal, discount, sale) < 0 or abs(subtotal - discount - sale) > 0.01:
                raise ValueError(f"Line {line_number}: subtotal, discount, and sale do not reconcile.")
            if timestamp.date() < START_DATE or timestamp.date() > END_DATE:
                raise ValueError(f"Line {line_number}: date is outside the generated three-year period.")

            branch_id = BRANCH_IDS[row["branch_name"]]
            service_id = SERVICE_IDS[row["service_name"]]
            key = (timestamp.date(), branch_id, service_id)
            daily[key]["transactions"] += 1
            daily[key]["revenue"] += sale
            min_date = timestamp.date() if min_date is None else min(min_date, timestamp.date())
            max_date = timestamp.date() if max_date is None else max(max_date, timestamp.date())
            transactions.append({
                "batch_id": None,
                "synthetic_id": transaction_id,
                "appointment_synthetic_id": row["booking_id"].strip(),
                "branch_id": branch_id,
                "transaction_date": timestamp,
                "subtotal": subtotal,
                "discount": discount,
                "total": sale,
                "payment_method": row["payment_method"].strip(),
            })

    if len(transactions) < 1_000:
        raise ValueError("At least 1,000 transaction rows are required for the training dataset.")
    if min_date != START_DATE or max_date != END_DATE:
        raise ValueError(f"CSV must include boundary dates {START_DATE} and {END_DATE}.")
    report = {
        "valid": True,
        "source": path.name,
        "data_origin": EXPECTED_ORIGIN,
        "transaction_rows": len(transactions),
        "date_range": [str(min_date), str(max_date)],
        "days": (max_date - min_date).days + 1,
        "branches": len(BRANCHES),
        "services": len(SERVICES),
        "model_target": "daily service-level synthetic revenue in PHP",
        "synthetic_transactions_are_isolated_from_operational_tables": True,
    }
    return transactions, daily, source_hash, report


def import_rows(path: Path, transactions, daily, source_hash: str, report: dict):
    from app.core.database import SessionLocal
    from app.models.synthetic_dataset import (
        SyntheticBranch, SyntheticDailyForecast, SyntheticImportBatch,
        SyntheticService, SyntheticTransaction,
    )

    db = SessionLocal()
    try:
        existing = db.query(SyntheticImportBatch).filter_by(source_sha256=source_hash).first()
        if existing:
            return {"imported": False, "reason": "This CSV has already been imported.", "batch_id": existing.id}
        batch = SyntheticImportBatch(source_sha256=source_hash, source_name=path.name, validation_report=report)
        db.add(batch)
        db.flush()

        db.bulk_insert_mappings(SyntheticBranch, [
            {"batch_id": batch.id, "synthetic_id": BRANCH_IDS[name], "name": name}
            for name in BRANCHES
        ])
        db.bulk_insert_mappings(SyntheticService, [
            {"batch_id": batch.id, "synthetic_id": service_id, "name": name, "price": price, "duration_minutes": 60}
            for service_id, (name, price) in enumerate(SERVICES, start=1)
        ])

        for offset in range(0, len(transactions), 2_000):
            chunk = transactions[offset:offset + 2_000]
            for record in chunk:
                record["batch_id"] = batch.id
            db.bulk_insert_mappings(SyntheticTransaction, chunk)

        daily_rows = []
        day_count = (END_DATE - START_DATE).days + 1
        for offset in range(day_count):
            current_day = START_DATE + timedelta(days=offset)
            for branch_id in BRANCH_IDS.values():
                for service_id in SERVICE_IDS.values():
                    aggregate = daily.get((current_day, branch_id, service_id), {})
                    count = aggregate.get("transactions", 0)
                    daily_rows.append({
                        "batch_id": batch.id,
                        "forecast_date": current_day,
                        "branch_id": branch_id,
                        "service_id": service_id,
                        "bookings": count,
                        "completed_bookings": count,
                        "cancelled_bookings": 0,
                        "no_show_bookings": 0,
                        "daily_revenue": round(aggregate.get("revenue", 0.0), 2),
                        "day_of_week": current_day.weekday(),
                        "is_weekend": current_day.weekday() >= 5,
                        "month": current_day.month,
                        "year": current_day.year,
                    })
                    if len(daily_rows) >= 5_000:
                        db.bulk_insert_mappings(SyntheticDailyForecast, daily_rows)
                        daily_rows.clear()
        if daily_rows:
            db.bulk_insert_mappings(SyntheticDailyForecast, daily_rows)
        db.commit()
        return {"imported": True, "batch_id": batch.id, **report}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", nargs="?", type=Path, default=BACKEND_DIR / "database" / "transactions_3_years_synthetic.csv")
    parser.add_argument("--import", dest="do_import", action="store_true", help="Import into synthetic staging tables; default is dry run")
    args = parser.parse_args()
    transactions, daily, source_hash, report = read_and_validate(args.csv_file)
    print(json.dumps(report, indent=2))
    if args.do_import:
        print(json.dumps(import_rows(args.csv_file, transactions, daily, source_hash, report), indent=2))
    else:
        print("Dry run only. No database writes were made. Use --import to stage this synthetic dataset for forecasting.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
