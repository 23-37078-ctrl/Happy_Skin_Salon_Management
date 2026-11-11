"""Reassign tagged sample history to the salon's real branch staff and remove demo logins."""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import func, or_
from sqlalchemy import text as sql_text
from app.core.database import SessionLocal
from app.models.auth_event import AuthEvent
from app.models.booking import Booking, BookingServiceItem
from app.models.booking_payment import BookingPayment
from app.models.branch import Branch
from app.models.day_closure import DayClosure
from app.models.feedback import Feedback
from app.models.promotion import Promotion
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User

TAG = "DEMO_HISTORY_2024_2026"
FEEDBACK_TAG = f"{TAG} SAMPLE FEEDBACK"
EMAIL_DOMAIN = "sample.happyskin.invalid"
MANILA = ZoneInfo("Asia/Manila")
STAFF_NAMES = {
    "cavite": ["Alyssa Bautista", "Danica Villanueva", "Francesca Lim", "Sofia Navarro", "Isabella Cruz", "Mia Santos", "Cheska Ramos", "Gabrielle Reyes", "Tina Mendoza", "Alexis Garcia"],
    "quezon": ["Angela Reyes", "Bea Torres", "Camille Mendoza", "Nicole Santos", "Mikaela Ramos", "Sofia Dela Cruz", "Lara Garcia", "Trisha Lim", "Patricia Cruz", "May Flores"],
    "lipa": ["Bianca Garcia", "Jasmine Torres", "Kristine Ramos", "Marielle Flores", "Ella Bautista", "Celine Navarro", "Mara Villanueva", "Rina Castillo", "Nina Mendoza", "Kyla Reyes"],
}
NAIL_SERVICE = re.compile(r"nail|manicure|pedicure|gel |acrylic|extension|nail art", re.I)
CLINICAL_SERVICE = re.compile(r"facial|peel|whiten|slimming|contour|cavitation|hifu|skin booster|micro.?needling|rf |led light", re.I)


def find_branches(db):
    result = {}
    branches = db.query(Branch).filter(Branch.is_active.is_(True)).all()
    for key in STAFF_NAMES:
        matches = [b for b in branches if key in (b.name + " " + b.address).casefold()]
        if len(matches) != 1:
            raise RuntimeError(f"Expected one active {key} branch, found {[b.name for b in matches]}.")
        result[key] = matches[0]
    return result


def get_staff(db, branches):
    result = {}
    for key, branch in branches.items():
        staff = db.query(User).filter(
            User.role == "staff", User.branch_id == branch.id,
            User.is_active.is_(True), User.full_name.in_(STAFF_NAMES[key]),
        ).all()
        if {user.full_name for user in staff} != set(STAFF_NAMES[key]) or len(staff) != 10:
            raise RuntimeError(f"The active {key} staff accounts do not exactly match the supplied list.")
        result[key] = staff
    return result


def local_time(value):
    return value.replace(tzinfo=MANILA) if value.tzinfo is None else value.astimezone(MANILA)


def select_provider(service, appointment, staff, assigned_counts, occupied):
    if NAIL_SERVICE.search(service.name):
        preferred = [person for person in staff if "nail" in (person.job_title or "").casefold()]
    elif CLINICAL_SERVICE.search(service.name):
        preferred = [person for person in staff if "nurse" in (person.job_title or "").casefold()]
    else:
        preferred = [person for person in staff if "nail" not in (person.job_title or "").casefold()]
    candidates = sorted(preferred or staff, key=lambda person: (assigned_counts[person.id], person.full_name))
    start = local_time(appointment)
    end = start + timedelta(minutes=max(15, service.duration_minutes or 60))
    for provider in candidates + [person for person in staff if person not in candidates]:
        if all(end <= old_start or start >= old_end for old_start, old_end in occupied[(provider.id, start.date())]):
            occupied[(provider.id, start.date())].append((start, end))
            assigned_counts[provider.id] += 1
            return provider
    raise RuntimeError(f"No non-overlapping staff slot for {service.name} at {start.isoformat()}.")


def chunks(items, size=1000):
    for offset in range(0, len(items), size):
        yield items[offset:offset + size]


def report(db, branches, staff_by_branch):
    for key, branch in branches.items():
        print(f"\n{branch.name} ({len(staff_by_branch[key])} supplied staff)")
        for person in staff_by_branch[key]:
            services, revenue, commission = (
                db.query(
                    func.count(Transaction.id),
                    func.coalesce(func.sum(Transaction.amount - Transaction.commission_amount), 0),
                    func.coalesce(func.sum(Transaction.commission_amount), 0),
                )
                .join(Booking, Booking.id == Transaction.booking_id)
                .filter(Booking.notes.like(f"{TAG}|{key}|%"), Transaction.service_provider_id == person.id)
                .one()
            )
            average, ratings = (
                db.query(func.avg(Feedback.staff_rating), func.count(Feedback.id))
                .join(Booking, Booking.id == Feedback.booking_id)
                .filter(
                    Booking.notes.like(f"{TAG}|{key}|%"),
                    Feedback.service_provider_id == person.id,
                    Feedback.staff_review.like(f"{FEEDBACK_TAG}%"),
                )
                .one()
            )
            print(f"  {person.full_name}: services={services}; net sample revenue=PHP {float(revenue):,.2f}; sample commission=PHP {float(commission):,.2f}; sample rating={float(average or 0):.1f} ({ratings})")
    active_demo_staff = db.query(func.count(User.id)).filter(
        User.email.like(f"demo.%@{EMAIL_DOMAIN}"),
        User.role.in_(["owner", "manager", "staff"]),
        User.is_active.is_(True),
    ).scalar()
    bad_bookings = (
        db.query(func.count(Booking.id))
        .join(User, User.id == Booking.service_provider_id)
        .filter(Booking.notes.like(f"{TAG}|%"), or_(User.role != "staff", User.branch_id != Booking.branch_id))
        .scalar()
    )
    bad_transactions = (
        db.query(func.count(Transaction.id))
        .join(Booking, Booking.id == Transaction.booking_id)
        .join(User, User.id == Transaction.service_provider_id)
        .filter(
            Booking.notes.like(f"{TAG}|%"),
            or_(User.role != "staff", User.branch_id != Booking.branch_id, Transaction.commission_rate != 10.0),
        )
        .scalar()
    )
    sample_ratings = db.query(func.count(Feedback.id)).filter(Feedback.staff_review.like(f"{FEEDBACK_TAG}%")).scalar()
    disabled_customers = db.query(func.count(User.id)).filter(
        User.email.like(f"demo.customer.%@{EMAIL_DOMAIN}"), User.is_active.is_(False), User.password_hash.is_(None)
    ).scalar()
    print(f"\nChecks: active demo employee logins={active_demo_staff}; branch-mismatched bookings={bad_bookings}; invalid sample transactions={bad_transactions}; tagged ratings={sample_ratings}; disabled synthetic customers={disabled_customers}")
    if active_demo_staff or bad_bookings or bad_transactions or not sample_ratings or disabled_customers != 240:
        raise RuntimeError("Post-update staff history verification failed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit staff reassignment, sample commissions/ratings, and demo login cleanup")
    parser.add_argument("--verify", action="store_true", help="Read-only staff performance report")
    args = parser.parse_args()
    if args.apply and args.verify:
        parser.error("--apply and --verify cannot be combined")

    db = SessionLocal()
    try:
        branches = find_branches(db)
        staff_by_branch = get_staff(db, branches)
        if args.verify:
            report(db, branches, staff_by_branch)
            return

        rows = (
            db.query(Booking, Service)
            .join(Service, Service.id == Booking.service_id)
            .filter(Booking.notes.like(f"{TAG}|%"))
            .order_by(Booking.branch_id, Booking.appointment_date, Booking.id)
            .all()
        )
        if not rows:
            raise RuntimeError("No tagged demo booking history was found.")
        branch_by_id = {branch.id: key for key, branch in branches.items()}
        booking_updates, provider_by_booking = [], {}
        assigned_counts, occupied = defaultdict(Counter), defaultdict(list)
        real_staff_ids = [person.id for people in staff_by_branch.values() for person in people]
        real_bookings = (
            db.query(Booking, Service)
            .join(Service, Service.id == Booking.service_id)
            .filter(
                Booking.branch_id.in_([branch.id for branch in branches.values()]),
                or_(Booking.service_provider_id.in_(real_staff_ids), Booking.preferred_service_provider_id.in_(real_staff_ids)),
                Booking.status != "cancelled",
                ~Booking.notes.like(f"{TAG}|%"),
            )
            .all()
        )
        real_staff_by_id = {person.id: person for people in staff_by_branch.values() for person in people}
        for real_booking, real_service in real_bookings:
            provider_id = real_booking.service_provider_id or real_booking.preferred_service_provider_id
            if provider_id not in real_staff_by_id:
                continue
            start = local_time(real_booking.appointment_date)
            end = start + timedelta(minutes=max(15, real_service.duration_minutes or 60))
            occupied[(provider_id, start.date())].append((start, end))
        for booking, service in rows:
            key = branch_by_id.get(booking.branch_id)
            if key is None or not booking.notes.startswith(f"{TAG}|{key}|"):
                raise RuntimeError(f"Booking {booking.id} has an unexpected branch/tag.")
            provider = select_provider(service, booking.appointment_date, staff_by_branch[key], assigned_counts[key], occupied)
            provider_by_booking[booking.id] = provider
            booking_updates.append({
                "id": booking.id,
                "service_provider_id": provider.id,
                "preferred_service_provider_id": provider.id,
            })

        transactions = (
            db.query(Transaction)
            .join(Booking, Booking.id == Transaction.booking_id)
            .filter(Booking.notes.like(f"{TAG}|%"))
            .all()
        )
        transaction_updates = []
        for transaction in transactions:
            provider = provider_by_booking.get(transaction.booking_id)
            if provider is None:
                raise RuntimeError(f"Transaction {transaction.id} has no tagged booking.")
            transaction_updates.append({
                "id": transaction.id,
                "staff_id": provider.id,
                "service_provider_id": provider.id,
                "commission_rate": 10.0,
                "commission_amount": round(float(transaction.amount) * 0.10, 2),
            })

        item_updates = []
        items = (
            db.query(BookingServiceItem)
            .join(Booking, Booking.id == BookingServiceItem.booking_id)
            .filter(Booking.notes.like(f"{TAG}|%"))
            .all()
        )
        for item in items:
            provider = provider_by_booking.get(item.booking_id)
            if provider:
                item_updates.append({"id": item.id, "service_provider_id": provider.id})

        existing_feedback = {
            booking_id for (booking_id,) in (
                db.query(Feedback.booking_id)
                .join(Booking, Booking.id == Feedback.booking_id)
                .filter(
                    Booking.notes.like(f"{TAG}|%"),
                    Feedback.staff_review.like(f"{FEEDBACK_TAG}%"),
                )
                .all()
            )
        }
        now = datetime.now(MANILA).replace(tzinfo=None)
        new_feedback = []
        for booking, _service in rows:
            provider = provider_by_booking[booking.id]
            if booking.status != "completed" or booking.id in existing_feedback or booking.id % 8 or not booking.customer_id:
                continue
            roll = (booking.id * 37 + 17) % 100
            rating = 5 if roll < 52 else 4 if roll < 88 else 3 if roll < 98 else 2
            appointment = booking.appointment_date
            appointment = appointment.replace(tzinfo=None) if appointment.tzinfo else appointment
            created_at = min(appointment + timedelta(days=1 + booking.id % 3), now)
            text = f"{FEEDBACK_TAG}: generated sample rating for historical demo data."
            new_feedback.append(Feedback(
                booking_id=booking.id,
                customer_id=booking.customer_id,
                service_provider_id=provider.id,
                rating=rating,
                review=text,
                staff_rating=rating,
                staff_review=text,
                branch_rating=rating,
                branch_review=text,
                created_at=created_at,
            ))

        remove_users = db.query(User).filter(
            User.email.like(f"demo.%@{EMAIL_DOMAIN}"),
            User.role.in_(["owner", "manager", "staff"]),
        ).all()
        disable_customers = db.query(User).filter(
            User.email.like(f"demo.customer.%@{EMAIL_DOMAIN}"),
            User.role == "customer",
        ).all()
        remove_ids = [person.id for person in remove_users]
        print(f"Sample data: bookings={len(rows):,}; transactions={len(transactions):,}; new tagged staff ratings={len(new_feedback):,}")
        print(f"Demo logins to remove: owner/manager/staff={len(remove_users)}; synthetic customer accounts to disable={len(disable_customers)}")
        if not args.apply:
            db.rollback()
            print("Dry run only; no database writes. Sample commission preview is 10%.")
            return

        db.execute(sql_text("CREATE TEMP TABLE demo_staff_map (booking_id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL) ON COMMIT DROP"))
        raw_cursor = db.connection().connection.cursor()
        try:
            from psycopg2.extras import execute_values

            execute_values(
                raw_cursor,
                "INSERT INTO demo_staff_map (booking_id, staff_id) VALUES %s",
                [(row["id"], row["service_provider_id"]) for row in booking_updates],
                page_size=5000,
            )
            execute_values(
                raw_cursor,
                """INSERT INTO feedback (booking_id, customer_id, service_provider_id, rating, review,
                   staff_rating, staff_review, branch_rating, branch_review, created_at) VALUES %s""",
                [(
                    row.booking_id, row.customer_id, row.service_provider_id, row.rating, row.review,
                    row.staff_rating, row.staff_review, row.branch_rating, row.branch_review, row.created_at,
                ) for row in new_feedback],
                page_size=1000,
            )
        finally:
            raw_cursor.close()

        updated_bookings = db.execute(sql_text("""
            UPDATE bookings b SET service_provider_id = m.staff_id, preferred_service_provider_id = m.staff_id
            FROM demo_staff_map m WHERE b.id = m.booking_id
        """)).rowcount
        updated_items = db.execute(sql_text("""
            UPDATE booking_service_items i SET service_provider_id = m.staff_id
            FROM demo_staff_map m WHERE i.booking_id = m.booking_id
        """)).rowcount
        updated_transactions = db.execute(sql_text("""
            UPDATE transactions t SET staff_id = m.staff_id, service_provider_id = m.staff_id,
                commission_rate = 10.0,
                commission_amount = round((t.amount * 0.10)::numeric, 2)::double precision
            FROM demo_staff_map m WHERE t.booking_id = m.booking_id
        """)).rowcount
        if updated_bookings != len(booking_updates) or updated_transactions != len(transactions):
            raise RuntimeError(f"Unexpected affected rows: bookings={updated_bookings}, transactions={updated_transactions}.")

        if remove_ids:
            db.query(AuthEvent).filter(AuthEvent.user_id.in_(remove_ids)).update({AuthEvent.user_id: None}, synchronize_session=False)
            db.query(BookingPayment).filter(BookingPayment.verified_by_id.in_(remove_ids)).update({BookingPayment.verified_by_id: None}, synchronize_session=False)
            db.query(DayClosure).filter(DayClosure.closed_by_id.in_(remove_ids)).update({DayClosure.closed_by_id: None}, synchronize_session=False)
            db.query(Promotion).filter(Promotion.created_by_id.in_(remove_ids)).update({Promotion.created_by_id: None}, synchronize_session=False)
            db.query(User).filter(User.id.in_(remove_ids)).delete(synchronize_session=False)
        if disable_customers:
            customer_ids = [person.id for person in disable_customers]
            db.query(User).filter(User.id.in_(customer_ids)).update(
                {User.is_active: False, User.password_hash: None, User.email_verified: False},
                synchronize_session=False,
            )
        db.commit()

        credentials = BACKEND_DIR / "private_uploads" / "demo_seed_credentials.txt"
        if credentials.exists():
            credentials.unlink()
        print("Applied. Seeded owner/manager/staff logins are removed; synthetic customer logins are disabled to preserve booking/rating links.")
        print("Generated sample commission is 10%; sample feedback is tagged as synthetic.")
        report(db, branches, staff_by_branch)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
