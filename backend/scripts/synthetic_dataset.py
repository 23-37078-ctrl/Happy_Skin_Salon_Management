"""Validate and optionally import the Happy Skin synthetic text export.

The bundle is a sectioned UTF-8 text file with one JSON object per data row.
It is deliberately loaded into synthetic_* staging tables, never operational
users/bookings/transactions. Default operation is dry-run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

EXPECTED = {
    "branches": 3,
    "services": 53,
    "appointments": 27617,
    "transactions": 20949,
    "items": 20949,
    "daily": 174423,
}
START, END = date(2023, 10, 15), date(2026, 10, 15)


def _section(line: str) -> str | None:
    value = line.strip().upper()
    if value.startswith("BRANCHES") and "RECORDS" in value: return "branches"
    if value.startswith("ACTIVE SERVICES") and "RECORDS" in value: return "services"
    if value.startswith("APPOINTMENTS") and "RECORDS" in value: return "appointments"
    if value.startswith("TRANSACTIONS") and "RECORDS" in value: return "transactions"
    if value.startswith("TRANSACTION ITEMS") and "RECORDS" in value: return "items"
    if value.startswith("DAILY") and "FORECAST" in value and "RECORDS" in value: return "daily"
    return None


def parse_bundle(path: Path) -> tuple[dict[str, list[dict[str, Any]]], str, dict[str, Any]]:
    """Parse text/zip export without extracting untrusted paths to disk."""
    raw_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            candidates = [item for item in archive.infolist() if item.filename.endswith("happy_skin_dataset_list.txt")]
            if len(candidates) != 1:
                raise ValueError("ZIP must contain exactly one happy_skin_dataset_list.txt")
            source = archive.open(candidates[0])
            stream = (line.decode("utf-8-sig") for line in source)
    else:
        source = path.open("r", encoding="utf-8-sig")
        stream = iter(source)
    records: dict[str, list[dict[str, Any]]] = defaultdict(list)
    summary: dict[str, Any] = {}
    section: str | None = None
    try:
        for line_number, line in enumerate(stream, 1):
            stripped = line.strip()
            if not stripped: continue
            found = _section(stripped)
            if found:
                section = found
                continue
            if stripped.startswith("="):
                continue
            if stripped.upper().startswith("BRANCH-SERVICE AVAILABILITY"):
                section = None
                continue
            if section == "services" and stripped.upper().startswith("APPOINTMENTS"):
                section = "appointments"
                continue
            if stripped.upper().startswith("APPOINTMENTS") and "RECORDS" in stripped.upper():
                section = "appointments"
                continue
            if stripped.upper().startswith("TRANSACTIONS") and "RECORDS" in stripped.upper():
                section = "transactions"
                continue
            if stripped.upper().startswith("TRANSACTION ITEMS") and "RECORDS" in stripped.upper():
                section = "items"
                continue
            if stripped.upper().startswith("DAILY") and "FORECAST" in stripped.upper() and "RECORDS" in stripped.upper():
                section = "daily"
                continue
            if stripped == "SUMMARY":
                section = "summary"
                continue
            if section is None or not stripped.startswith("{"):
                continue
            try:
                value = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Malformed JSON at line {line_number}: {exc.msg}") from exc
            if not isinstance(value, dict):
                raise ValueError(f"Expected JSON object at line {line_number}")
            if section == "summary": summary = value
            else: records[section].append(value)
    finally:
        source.close()
    return records, raw_hash, summary


def validate(records: dict[str, list[dict[str, Any]]], summary: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    for section, expected in EXPECTED.items():
        actual = len(records.get(section, []))
        if actual != expected:
            errors.append(f"{section}: expected {expected}, found {actual}")
        if summary:
            key = {"items": "transaction_items"}.get(section, section)
            if summary.get(key) is not None and summary[key] != expected:
                errors.append(f"summary {key} says {summary[key]}, expected {expected}")
    branches = records.get("branches", [])
    services = records.get("services", [])
    branch_ids = {row.get("branch_id") for row in branches}
    service_ids = {row.get("service_id") for row in services}
    if len(branch_ids) != 3: errors.append("branch IDs are missing or duplicated")
    if len(service_ids) != 53: errors.append("active service IDs are missing or duplicated")
    if len(branch_ids) * len(service_ids) != 159: errors.append("branch-service combinations do not total 159")

    appointments = records.get("appointments", [])
    appointment_ids = {row.get("appointment_id") for row in appointments}
    if len(appointment_ids) != len(appointments): errors.append("duplicate appointment IDs")
    for row in appointments:
        if row.get("branch_id") not in branch_ids: errors.append("appointment references unknown branch"); break
        if row.get("service_id") not in service_ids: errors.append("appointment references unknown service"); break
        try: datetime.fromisoformat(row["appointment_datetime"])
        except (KeyError, ValueError, TypeError): errors.append("appointment contains invalid datetime"); break
        if row.get("status") not in {"completed", "cancelled", "no_show", "pending", "confirmed"}:
            errors.append("appointment contains unsupported status"); break
    transactions = records.get("transactions", [])
    tx_ids = {row.get("transaction_id") for row in transactions}
    if len(tx_ids) != len(transactions): errors.append("duplicate transaction IDs")
    appointment_status = {row.get("appointment_id"): row.get("status") for row in appointments}
    for row in transactions:
        if row.get("appointment_id") not in appointment_ids: errors.append("transaction references unknown appointment"); break
        if appointment_status.get(row["appointment_id"]) != "completed": errors.append("transaction references non-completed appointment"); break
        if row.get("branch_id") not in branch_ids: errors.append("transaction references unknown branch"); break
        try:
            vals = [float(row[k]) for k in ("subtotal_php", "discount_php", "total_php")]
            if min(vals) < 0 or abs(vals[0] - vals[1] - vals[2]) > 0.02: errors.append("transaction totals do not reconcile"); break
        except (KeyError, ValueError, TypeError): errors.append("transaction has invalid financial values"); break
    if len({row.get("appointment_id") for row in transactions}) != len(transactions): errors.append("more than one transaction per appointment")
    transaction_by_id = {row.get("transaction_id"): row for row in transactions}
    items = records.get("items", [])
    item_ids = {row.get("transaction_item_id", row.get("item_id")) for row in items}
    if len(item_ids) != len(items): errors.append("duplicate transaction item IDs")
    item_totals: dict[str, float] = defaultdict(float)
    for row in items:
        tx_id = row.get("transaction_id")
        if tx_id not in transaction_by_id: errors.append("item references unknown transaction"); break
        if row.get("service_id") not in service_ids: errors.append("item references unknown service"); break
        try: item_totals[tx_id] += float(row.get("line_total_php", row.get("total_php")))
        except (TypeError, ValueError): errors.append("item has invalid total"); break
    for tx_id, total in item_totals.items():
        if abs(total - float(transaction_by_id[tx_id]["total_php"])) > 0.02:
            errors.append(f"transaction {tx_id} item totals do not reconcile"); break

    daily = records.get("daily", [])
    unique_keys: set[tuple[Any, ...]] = set()
    daily_dates: set[date] = set()
    for row in daily:
        try:
            day = date.fromisoformat(row["date"])
            key = (day, row["branch_id"], row["service_id"])
            if key in unique_keys: errors.append("duplicate daily forecast key"); break
            unique_keys.add(key); daily_dates.add(day)
            if row["branch_id"] not in branch_ids or row["service_id"] not in service_ids: errors.append("daily row references unknown branch/service"); break
        except (KeyError, TypeError, ValueError): errors.append("invalid daily forecast row"); break
    expected_days = (END - START).days + 1
    if len(daily_dates) != expected_days or (daily_dates and (min(daily_dates) != START or max(daily_dates) != END)):
        errors.append(f"daily dates must cover {START} through {END} ({expected_days} days)")
    if len(unique_keys) != 174423: errors.append(f"daily unique combination count is {len(unique_keys)}, expected 174423")
    report = {"valid": not errors, "errors": errors, "counts": {key: len(records.get(key, [])) for key in EXPECTED}, "branches": sorted(branch_ids), "active_service_ids": sorted(service_ids), "date_range": [str(START), str(END)], "days": expected_days, "branch_service_combinations": len(branch_ids) * len(service_ids), "daily_unique_keys": len(unique_keys), "source_summary": summary}
    return report


def import_validated(path: Path, records: dict[str, list[dict[str, Any]]], source_hash: str, report: dict[str, Any]) -> dict[str, Any]:
    from app.core.database import SessionLocal
    from app.models.synthetic_dataset import (SyntheticAppointment, SyntheticBranch, SyntheticDailyForecast, SyntheticImportBatch, SyntheticService, SyntheticTransaction, SyntheticTransactionItem)
    db = SessionLocal()
    try:
        existing = db.query(SyntheticImportBatch).filter_by(source_sha256=source_hash).first()
        if existing:
            return {"imported": False, "reason": "source already imported", "batch_id": existing.id}
        batch = SyntheticImportBatch(source_sha256=source_hash, source_name=path.name, validation_report=report)
        db.add(batch); db.flush()
        db.add_all([SyntheticBranch(batch_id=batch.id, synthetic_id=r["branch_id"], name=r["branch_name"]) for r in records["branches"]])
        db.add_all([SyntheticService(batch_id=batch.id, synthetic_id=r["service_id"], name=r["service_name"], price=float(r["price_php"]), duration_minutes=int(r["duration_minutes"])) for r in records["services"]])
        db.add_all([SyntheticAppointment(batch_id=batch.id, synthetic_id=r["appointment_id"], branch_id=r["branch_id"], service_id=r["service_id"], appointment_date=datetime.fromisoformat(r["appointment_datetime"]), status=r["status"], customer_synthetic_id=r["customer_id"], staff_synthetic_id=r["staff_id"]) for r in records["appointments"]])
        db.add_all([SyntheticTransaction(batch_id=batch.id, synthetic_id=r["transaction_id"], appointment_synthetic_id=r["appointment_id"], branch_id=r["branch_id"], transaction_date=datetime.fromisoformat(r["transaction_datetime"]), subtotal=float(r["subtotal_php"]), discount=float(r["discount_php"]), total=float(r["total_php"]), payment_method=r["payment_method"]) for r in records["transactions"]])
        db.add_all([SyntheticTransactionItem(batch_id=batch.id, synthetic_id=r.get("transaction_item_id", r.get("item_id", f"{r['transaction_id']}-{r['service_id']}")), transaction_synthetic_id=r["transaction_id"], service_id=r["service_id"], quantity=int(r.get("quantity", 1)), unit_price=float(r.get("unit_price_php", r.get("price_php", 0))), discount=0.0, line_total=float(r.get("line_total_php", r.get("total_php", 0))) ) for r in records["items"]])
        db.add_all([SyntheticDailyForecast(batch_id=batch.id, forecast_date=date.fromisoformat(r["date"]), branch_id=r["branch_id"], service_id=r["service_id"], bookings=int(r["bookings"]), completed_bookings=int(r["completed_bookings"]), cancelled_bookings=int(r["cancelled_bookings"]), no_show_bookings=int(r["no_show_bookings"]), daily_revenue=float(r.get("daily_revenue_php", r.get("daily_revenue", 0))), day_of_week=int(r["day_of_week"]), is_weekend=bool(r["is_weekend"]), month=int(r["month"]), year=int(r["year"])) for r in records["daily"]])
        db.commit()
        return {"imported": True, "batch_id": batch.id, "counts": report["counts"]}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="ZIP bundle or extracted sectioned text file")
    parser.add_argument("--import", dest="do_import", action="store_true", help="Commit valid data into synthetic staging tables (default is dry-run)")
    args = parser.parse_args()
    records, source_hash, summary = parse_bundle(args.bundle)
    report = validate(records, summary)
    print(json.dumps({"source_sha256": source_hash, **report}, indent=2, ensure_ascii=False))
    if not report["valid"]:
        return 2
    if args.do_import:
        print(json.dumps(import_validated(args.bundle, records, source_hash, report), indent=2))
    else:
        print("Dry run only. No database writes were made.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
