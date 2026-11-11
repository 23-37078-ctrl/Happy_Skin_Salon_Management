"""Insert clearly labeled, interconnected demo history into operational tables.

The generated records are synthetic and must never be interpreted as real payments.
The script refuses to overwrite existing records and is safe to rerun.
"""
from __future__ import annotations

import argparse
import math
import secrets
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from random import Random
from zoneinfo import ZoneInfo

from sqlalchemy import func

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.booking import Booking, BookingServiceItem  # noqa: E402
from app.models.branch import Branch  # noqa: E402
from app.models.service import Service  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from app.models.user import User  # noqa: E402


TAG = "DEMO_HISTORY_2024_2026"
EMAIL_DOMAIN = "sample.happyskin.invalid"
MANILA = ZoneInfo("Asia/Manila")
START_DATE = date(2024, 1, 1)
RNG_SEED = 20261102
BRANCHES = {"cavite": "Cavite", "quezon": "Quezon", "lipa": "Lipa"}
FIRST_NAMES = ["Amara", "Bea", "Celine", "Dani", "Elise", "Faith", "Gia", "Hana", "Ivy", "Janelle", "Kara", "Leah", "Mika", "Nina", "Olive", "Paula", "Queenie", "Rina", "Sofia", "Tala", "Una", "Vera", "Wendy", "Ysa", "Zia"]
LAST_NAMES = ["Abad", "Bautista", "Cruz", "Dizon", "Enriquez", "Flores", "Garcia", "Hernandez", "Ignacio", "Jimenez", "Lazaro", "Mendoza", "Navarro", "Ocampo", "Pascual", "Reyes", "Santos", "Torres", "Uy", "Villanueva"]


def branch_key(value: str) -> str:
    return "".join(ch for ch in value.casefold() if ch.isalnum())


def find_branches(db):
    branches = db.query(Branch).filter(Branch.is_active.is_(True)).all()
    found = {}
    for key, label in BRANCHES.items():
        # The configured Quezon branch is currently named "Main Branch" and is
        # physically in Quezon City. Match its location without renaming it.
        matches = [branch for branch in branches if key in branch_key(branch.name) or key in branch_key(branch.address)]
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one active {label} branch; found {[b.name for b in matches]}.")
        found[key] = matches[0]
    if len({branch.id for branch in found.values()}) != len(found):
        raise RuntimeError("Cavite, Quezon, and Lipa must resolve to three distinct branches.")
    return found


def ensure_user(db, *, email, name, role, branch_id=None, job_title=None, new_passwords=None, customer_password_hash=None, created_at=None):
    user = db.query(User).filter(User.email == email).one_or_none()
    if user:
        if (user.role, user.branch_id) != (role, branch_id):
            raise RuntimeError(f"Existing account {email} has a different role or branch; refusing to modify it.")
        return user
    password = secrets.token_urlsafe(18) if role != "customer" else None
    user = User(
        full_name=name,
        email=email,
        password_hash=hash_password(password) if password else customer_password_hash,
        role=role,
        branch_id=branch_id,
        job_title=job_title,
        is_active=True,
        email_verified=True,
        phone_verified=False,
        otp_method="email",
        created_at=created_at or datetime(2023, 12, 1),
        updated_at=created_at or datetime(2023, 12, 1),
    )
    db.add(user)
    db.flush()
    if password:
        new_passwords[email] = password
    return user


def build_users(db, branches, new_passwords):
    customer_password_hash = hash_password(secrets.token_urlsafe(24))
    owner = ensure_user(
        db, email=f"demo.owner@{EMAIL_DOMAIN}", name="Demo Owner", role="owner", new_passwords=new_passwords
    )
    staff_by_branch = {}
    for key, branch in branches.items():
        ensure_user(
            db,
            email=f"demo.manager.{key}@{EMAIL_DOMAIN}",
            name=f"Demo {branch.name} Manager",
            role="manager",
            branch_id=branch.id,
            job_title="Branch Manager",
            new_passwords=new_passwords,
        )
        staff = []
        for number in range(1, 6):
            staff.append(
                ensure_user(
                    db,
                    email=f"demo.staff.{key}.{number:02d}@{EMAIL_DOMAIN}",
                    name=f"Demo {branch.name} Staff {number}",
                    role="staff",
                    branch_id=branch.id,
                    job_title="Beauty Therapist",
                    new_passwords=new_passwords,
                )
            )
        staff_by_branch[key] = staff

    customers_by_branch = {}
    for key, branch in branches.items():
        customers = []
        for number in range(1, 81):
            first = FIRST_NAMES[(number * 7 + len(key)) % len(FIRST_NAMES)]
            last = LAST_NAMES[(number * 11 + len(key) * 3) % len(LAST_NAMES)]
            customers.append(
                ensure_user(
                    db,
                    email=f"demo.customer.{key}.{number:03d}@{EMAIL_DOMAIN}",
                    name=f"{first} {last} {number:03d}",
                    role="customer",
                    new_passwords=new_passwords,
                    customer_password_hash=customer_password_hash,
                )
            )
        customers_by_branch[key] = customers
    return owner, staff_by_branch, customers_by_branch


def seasonal_weight(day: date) -> float:
    weight = 1.0
    if day.month in (2, 5, 12):
        weight *= 1.32 if day.month != 5 else 1.2
    if day.month == 12 and day.day >= 10:
        weight *= 1.22
    if day.month == 2 and 10 <= day.day <= 16:
        weight *= 1.35
    if day.month == 5 and 5 <= day.day <= 15:
        weight *= 1.25
    if day.weekday() >= 5:
        weight *= 1.4
    # Philippine national holidays and the days around major occasions tend to bring more visits.
    if (day.month, day.day) in {(1, 1), (2, 25), (4, 9), (5, 1), (6, 12), (8, 21), (11, 1), (11, 30), (12, 8), (12, 25), (12, 30)}:
        weight *= 1.25
    return weight


def reserve_slot(rng, staff, day, duration, busy):
    duration_slots = max(2, math.ceil((duration or 60) / 30))
    starts = list(range(18))  # 09:00 through 17:30, in half-hour increments
    rng.shuffle(starts)
    staff_order = list(staff)
    rng.shuffle(staff_order)
    for provider in staff_order:
        for slot in starts:
            occupied = busy[(provider.id, day)]
            slots = range(slot, min(18, slot + duration_slots))
            if len(slots) == duration_slots and not any(s in occupied for s in slots):
                occupied.update(slots)
                return provider, datetime.combine(day, time(9, 0)) + timedelta(minutes=30 * slot)
    return None, None


def plan_counts(branch_key_name, start_day, end_day, rng):
    services = []
    branch = _BRANCHES[branch_key_name]
    eligible = [service for service in branch.services if service.is_active]
    if not eligible:
        raise RuntimeError(f"Branch {branch.name} has no active services assigned.")
    counts = Counter()
    tx_counts = Counter()
    annual_sales = Counter()
    busy = defaultdict(set)
    planned = []
    sequence = 0
    day = start_day
    customers = _CUSTOMERS[branch_key_name]
    staff = _STAFF[branch_key_name]
    while day <= end_day:
        base = 8.5 + (1.3 if branch_key_name == "cavite" else 0.0) + (0.4 if branch_key_name == "lipa" else 0.0)
        demand = max(2, round(rng.gauss(base * seasonal_weight(day), 2.1)))
        for _ in range(demand):
            service = rng.choices(eligible, weights=[max(1, 2.2 / math.sqrt(max(0.5, service.price / 500))) for service in eligible], k=1)[0]
            provider, appointment_local = reserve_slot(rng, staff, day, service.duration_minutes, busy)
            if provider is None:
                continue
            sequence += 1
            appointment = appointment_local.replace(tzinfo=MANILA)
            days_ahead = rng.choices([0, 1, 2, 4, 7, 14, 30], weights=[8, 10, 15, 18, 23, 20, 6], k=1)[0]
            created_at = appointment.replace(tzinfo=None) - timedelta(days=days_ahead, minutes=rng.randint(5, 720))
            # Do not create account/booking creation timestamps in the future for same-day appointments.
            current_local = datetime.now(MANILA)
            if day == current_local.date() and created_at > current_local.replace(tzinfo=None):
                created_at = current_local.replace(tzinfo=None) - timedelta(minutes=rng.randint(1, 300))
            future_appointment = appointment > current_local
            if future_appointment:
                status = "confirmed" if rng.random() < 0.82 else "pending"
            else:
                status = "cancelled" if rng.random() < 0.105 else "completed"
            customer = rng.choice(customers)
            note = f"{TAG}|{branch_key_name}|{sequence:06d}|Synthetic demo history; not a real customer payment."
            booking = Booking(
                customer_id=customer.id,
                branch_id=branch.id,
                service_id=service.id,
                service_provider_id=provider.id,
                preferred_service_provider_id=provider.id,
                appointment_date=appointment,
                status=status,
                notes=note[:255],
                created_at=created_at,
                updated_at=created_at,
            )
            planned.append((booking, service, provider, status, appointment, day, sequence, rng.choice(("cash", "gcash", "card", "bank_transfer", "paypal"))))
            counts[(day.year, status)] += 1
            if status == "completed":
                tx_counts[day.year] += 1
                annual_sales[day.year] += float(service.price)
        day += timedelta(days=1)
    return planned, counts, tx_counts, annual_sales


def verify_seed(db, branches):
    print("Verification: database-backed operational records")
    failed = False
    for key, branch in branches.items():
        booking_rows = (
            db.query(func.extract("year", Booking.appointment_date).label("year"), func.count(Booking.id))
            .filter(Booking.branch_id == branch.id, Booking.notes.like(f"{TAG}|{key}|%"))
            .group_by("year")
            .order_by("year")
            .all()
        )
        sales_rows = (
            db.query(func.extract("year", Booking.appointment_date).label("year"), func.count(Transaction.id), func.coalesce(func.sum(Transaction.amount - Transaction.commission_amount), 0))
            .join(Transaction, Transaction.booking_id == Booking.id)
            .filter(Booking.branch_id == branch.id, Booking.notes.like(f"{TAG}|{key}|%"))
            .group_by("year")
            .order_by("year")
            .all()
        )
        bookings_by_year = {int(year): count for year, count in booking_rows}
        print(f"\n{branch.name}: bookings={sum(bookings_by_year.values()):,}")
        for year in (2024, 2025, 2026):
            transactions, sales = next(((count, amount) for y, count, amount in sales_rows if int(y) == year), (0, 0))
            count = bookings_by_year.get(year, 0)
            print(f"  {year}: bookings={count:,}; transactions={transactions:,}; sales=PHP {float(sales):,.2f}")
            if not count or not transactions:
                failed = True
        inconsistent = (
            db.query(func.count(Booking.id))
            .outerjoin(Transaction, Transaction.booking_id == Booking.id)
            .filter(Booking.branch_id == branch.id, Booking.notes.like(f"{TAG}|{key}|%"), Booking.status == "completed", Transaction.id.is_(None))
            .scalar()
        )
        invalid_transactions = (
            db.query(func.count(Transaction.id))
            .join(Booking, Transaction.booking_id == Booking.id)
            .filter(Booking.branch_id == branch.id, Booking.notes.like(f"{TAG}|{key}|%"), Booking.status != "completed")
            .scalar()
        )
        duplicate_transactions = (
            db.query(Transaction.booking_id, func.count(Transaction.id))
            .join(Booking, Transaction.booking_id == Booking.id)
            .filter(Booking.branch_id == branch.id, Booking.notes.like(f"{TAG}|{key}|%"))
            .group_by(Transaction.booking_id)
            .having(func.count(Transaction.id) > 1)
            .count()
        )
        print(f"  completed bookings without transaction={inconsistent}; non-completed bookings with transaction={invalid_transactions}; duplicate booking transactions={duplicate_transactions}")
        if inconsistent or invalid_transactions or duplicate_transactions:
            failed = True
        manager_count = db.query(User).filter(User.role == "manager", User.branch_id == branch.id, User.email == f"demo.manager.{key}@{EMAIL_DOMAIN}").count()
        staff_count = db.query(User).filter(User.role == "staff", User.branch_id == branch.id, User.email.like(f"demo.staff.{key}.%@{EMAIL_DOMAIN}")).count()
        print(f"  assigned demo manager={manager_count}; assigned demo staff={staff_count}")
        if manager_count != 1 or staff_count != 5:
            failed = True
    owner_count = db.query(User).filter(User.role == "owner", User.email == f"demo.owner@{EMAIL_DOMAIN}").count()
    print(f"\nGlobal demo owner accounts={owner_count}; branch managers are scoped to the three branch IDs.")
    if owner_count != 1:
        failed = True
    if failed:
        raise RuntimeError("Verification failed. Review the reported branch/status relationships before relying on the demo reports.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit labeled demo accounts, bookings, and transactions to the configured operational database")
    parser.add_argument("--verify", action="store_true", help="Read-only verification/report for records carrying the demo seed marker")
    parser.add_argument("--through", type=date.fromisoformat, default=datetime.now(MANILA).date(), help="Last appointment date, YYYY-MM-DD (defaults to today in Asia/Manila)")
    parser.add_argument("--seed", type=int, default=RNG_SEED, help="Random seed for reproducible booking demand")
    args = parser.parse_args()
    if args.apply and args.verify:
        parser.error("--apply and --verify cannot be used together")
    if args.through < START_DATE:
        parser.error("--through must be on or after 2024-01-01")

    db = SessionLocal()
    new_passwords = {}
    try:
        global _BRANCHES, _STAFF, _CUSTOMERS
        _BRANCHES = find_branches(db)
        if args.verify:
            verify_seed(db, _BRANCHES)
            return
        existing_demo_count = db.query(Booking).filter(Booking.notes.like(f"{TAG}|%")).count()
        if existing_demo_count:
            raise RuntimeError(f"Found {existing_demo_count} {TAG} booking(s). Refusing to duplicate or partially overwrite an existing seed.")
        branches, staff_by_branch, customers_by_branch = _BRANCHES, None, None
        services_missing = [branch.name for branch in branches.values() if not any(s.is_active for s in branch.services)]
        if services_missing:
            raise RuntimeError(f"No active branch services configured for: {', '.join(services_missing)}")

        owner, _STAFF, _CUSTOMERS = build_users(db, branches, new_passwords)
        rng = Random(args.seed)
        all_planned = []
        summary = {}
        for key, branch in branches.items():
            planned, status_counts, transaction_counts, sales = plan_counts(key, START_DATE, args.through, rng)
            all_planned.extend((key, item) for item in planned)
            summary[key] = (status_counts, transaction_counts, sales)

        if args.apply:
            # Commit accounts and all interrelated demo history together. A failure rolls back the entire batch.
            db.flush()
            db.add_all([item[0] for _, item in all_planned])
            db.flush()
            service_items, transaction_rows = [], []
            for key, item in all_planned:
                booking, service, provider, status, appointment, day, sequence, method = item
                service_items.append(BookingServiceItem(booking_id=booking.id, service_id=service.id, service_provider_id=provider.id))
                if status == "completed":
                    transaction = Transaction(
                        booking_id=booking.id,
                        idempotency_key=f"demo-history-24-26:{key}:{sequence:06d}",
                        staff_id=provider.id,
                        service_provider_id=provider.id,
                        amount=float(service.price),
                        payment_method=method,
                        additional_charge=0,
                        commission_rate=0,
                        commission_amount=0,
                        created_at=(appointment.replace(tzinfo=None) + timedelta(minutes=service.duration_minutes or 60)),
                    )
                    transaction_rows.append(transaction)
            db.add_all(service_items)
            db.add_all(transaction_rows)
            db.commit()
        else:
            db.rollback()

        print(f"Mode: {'APPLIED' if args.apply else 'DRY RUN (no writes)'}")
        print(f"Period: {START_DATE.isoformat()} through {args.through.isoformat()} (current date only; no future-dated history)")
        print(f"Branches: {', '.join(f'{branch.name} [id={branch.id}]' for branch in branches.values())}")
        print(f"Demo users: owner=1, managers=3, staff=15, customers=240 (newly created admin/staff credentials: {len(new_passwords)})")
        for key, branch in branches.items():
            status_counts, transaction_counts, sales = summary[key]
            print(f"\n{branch.name}: bookings={sum(status_counts.values()):,}; transactions={sum(transaction_counts.values()):,}")
            for year in sorted({year for year, _ in status_counts}):
                print(f"  {year}: bookings={sum(n for (y, _), n in status_counts.items() if y == year):,}; transactions={transaction_counts[year]:,}; gross sales=PHP {sales[year]:,.2f}")
        if args.apply and new_passwords:
            credential_file = BACKEND_DIR / "private_uploads" / "demo_seed_credentials.txt"
            credential_file.parent.mkdir(parents=True, exist_ok=True)
            credential_file.write_text(
                "Synthetic demo accounts only. Do not deploy or commit these credentials.\n"
                + "\n".join(f"{email}\t{password}" for email, password in new_passwords.items())
                + "\n",
                encoding="utf-8",
            )
            print(f"\nNew demo account credentials saved to {credential_file} (private, git-ignored):")
            for email, password in new_passwords.items():
                print(f"  {email} | {password}")
        if args.apply:
            print("\nInserted records are synthetic demo history; amounts are not real received funds. Each booking is labeled DEMO_HISTORY_2024_2026.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
