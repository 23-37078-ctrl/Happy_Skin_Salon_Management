from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes.customer import create_customer_group_appointment
from app.api.v1.routes.customer import get_customer_dashboard, list_customer_branches
from app.api.v1.routes import transactions as transaction_routes
from app.api.v1.routes.owner import get_owner_dashboard, get_owner_dashboard_performance
from app.api.v1.routes.manager import get_manager_reports, get_manager_dashboard_performance
from app.core.database import Base
from app.models.booking import Booking, BookingServiceItem, GroupBookingMember
from app.models.booking_payment import BookingPayment
from app.models.promotion import Promotion
from app.models.branch import Branch
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.booking import GroupBookingCreateRequest
from app.schemas.booking import BookingServiceItemStatusRequest


@pytest.fixture()
def group_booking_context():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    branch = Branch(name="Main Branch", address="Main Street", is_active=True)
    gel = Service(name="Gel Manicure", price=500, duration_minutes=40, is_active=True)
    facial = Service(name="Signature Facial", price=900, duration_minutes=60, is_active=True)
    branch.services.extend([gel, facial])
    customer = User(full_name="Booker", email="booker@example.com", role="customer", phone_number="+639171234567", phone_verified=True)
    staff = [User(full_name=f"Staff Member {index}", email=f"staff{index}@example.com", role="staff", job_title="Salon Specialist", is_active=True) for index in range(1, 4)]
    db.add_all([branch, customer, *staff])
    db.flush()
    for member in staff:
        member.branch_id = branch.id
    db.commit()
    yield db, customer, branch, gel, facial
    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_group_booking_saves_one_booking_and_distinct_repeated_service_assignments(group_booking_context, monkeypatch):
    db, customer, branch, gel, facial = group_booking_context
    appointment = datetime.combine(datetime.now(ZoneInfo("Asia/Manila")).date() + timedelta(days=1), time(11), ZoneInfo("Asia/Manila"))
    payload = GroupBookingCreateRequest(
        branch_id=branch.id,
        appointment_date=appointment,
        booker_service_ids=[gel.id],
        members=[
            {"name": "Friend One", "contact_number": "09171112222", "service_ids": [gel.id]},
            {"name": "Friend Two", "service_ids": [gel.id, facial.id]},
        ],
    )

    result = create_customer_group_appointment(payload, current_user=customer, db=db)

    bookings = db.query(Booking).all()
    members = db.query(GroupBookingMember).filter_by(booking_id=result.id).all()
    assignments = db.query(BookingServiceItem).filter_by(booking_id=result.id).all()
    payment = db.query(Transaction).filter_by(booking_id=result.id).first()
    booking_payment = db.query(BookingPayment).filter_by(booking_id=result.id).one()
    assert len(bookings) == 1
    assert len(members) == 3
    assert len(assignments) == 4
    assert len({item.id for item in assignments}) == 4
    assert len({item.member_id for item in assignments}) == 3
    assert sum(item.service_price for item in assignments) == pytest.approx(2400)
    assert sum(item.service_duration_minutes for item in assignments) == 180
    assert booking_payment.amount == pytest.approx(2400)
    assert all(item.appointment_start and item.appointment_end and item.service_provider_id for item in assignments)
    simultaneous = [item for item in assignments if item.appointment_start == min(row.appointment_start for row in assignments)]
    assert len(simultaneous) == 3
    assert len({item.service_provider_id for item in simultaneous}) == 3
    assert result.group_reference.startswith(f"GB-{appointment.year}-")
    assert payment is None  # Online checkout is represented by one booking payment, not duplicate transactions.
    owner = User(full_name="Owner", email="owner@example.com", role="owner")
    db.add(owner)
    db.add(Transaction(booking_id=result.id, amount=2400, payment_method="cash"))
    db.commit()
    report = get_owner_dashboard(current_user=owner, db=db)
    demand = {row["service"]: row for row in report["service_demand"]}
    assert report["stats"]["bookings"] == 1
    assert demand["Gel Manicure"]["bookings"] == 3
    assert demand["Signature Facial"]["bookings"] == 1
    assert sum(row["sales"] for row in demand.values()) == pytest.approx(2400)
    manager = User(full_name="Manager", email="manager@example.com", role="manager", branch_id=branch.id)
    db.add(manager)
    db.commit()
    manager_report = get_manager_reports(period="custom", start_date=date.fromisoformat(appointment.date().isoformat()),
                                         end_date=date.fromisoformat(appointment.date().isoformat()), staff_id=None,
                                         service_id=None, booking_type=None, appointment_status=None, payment_method=None,
                                         current_user=manager, db=db)
    manager_demand = {row["name"]: row for row in manager_report["services"]}
    assert manager_report["summary"]["bookings"] == 1
    assert manager_demand["Gel Manicure"]["bookings"] == 3
    db.query(BookingServiceItem).filter_by(booking_id=result.id).update({BookingServiceItem.status: "completed"})
    db.query(Booking).filter_by(id=result.id).update({Booking.status: "completed"})
    db.commit()
    staff = db.query(User).filter(User.role == "staff", User.branch_id == branch.id).first()
    manager_performance = get_manager_dashboard_performance(period="weekly", report_date=appointment.date(), current_user=manager, db=db)
    from app.api.v1.routes import owner as owner_routes
    report_start = datetime.combine(appointment.date(), time.min, ZoneInfo("Asia/Manila")).astimezone(ZoneInfo("UTC"))
    report_end = report_start + timedelta(days=1)
    monkeypatch.setattr(owner_routes, "_period_bounds", lambda _period, *_args: (report_start, report_end))
    owner_performance = get_owner_dashboard_performance(period="weekly", current_user=owner, db=db)
    manager_staff = manager_performance["staff"]
    owner_staff = owner_performance["branches"][0]["staff"]
    assert sum(row["services_completed"] for row in manager_staff) == 4
    assert sum(row["revenue"] for row in manager_staff) == pytest.approx(2400)
    assert sum(row["services_completed"] for row in owner_staff) == 4


def test_customer_dashboard_returns_services_branches_and_handles_naive_appointment_time(group_booking_context):
    db, customer, branch, gel, _ = group_booking_context
    branch.is_active = True
    gel.is_active = True
    db.commit()
    appointment = datetime.now(ZoneInfo("Asia/Manila")) + timedelta(days=1)
    db.add(Booking(customer_id=customer.id, branch_id=branch.id, service_id=gel.id,
                   appointment_date=appointment.replace(tzinfo=None), status="confirmed"))
    db.commit()

    dashboard = get_customer_dashboard(current_user=customer, db=db)
    branches = list_customer_branches(current_user=customer, db=db)

    assert dashboard["upcoming_bookings_count"] == 1
    assert dashboard["upcoming_booking"]["payment_status"] == "unpaid"
    assert dashboard["recommended_services"][0]["name"] == "Gel Manicure"
    assert len(branches) == 1
    assert branches[0]["services"][0]["name"] == "Gel Manicure"


def test_group_service_failures_do_not_reserve_a_partial_booking(group_booking_context):
    db, customer, branch, gel, _ = group_booking_context
    appointment = datetime.combine(datetime.now(ZoneInfo("Asia/Manila")).date() + timedelta(days=1), time(11), ZoneInfo("Asia/Manila"))
    extra_staff = db.query(User).filter(User.role == "staff", User.branch_id == branch.id).order_by(User.id.desc()).all()
    for member in extra_staff[1:]:
        db.delete(member)
    db.commit()
    payload = GroupBookingCreateRequest(branch_id=branch.id, appointment_date=appointment,
                                        members=[{"name": "Friend", "service_ids": [gel.id]}],
                                        booker_service_ids=[gel.id])

    with pytest.raises(HTTPException) as exc_info:
        create_customer_group_appointment(payload, current_user=customer, db=db)

    assert exc_info.value.status_code == 409
    assert db.query(Booking).count() == 0
    assert db.query(GroupBookingMember).count() == 0


def test_group_service_completion_and_cancellation_are_independent(group_booking_context, monkeypatch):
    db, customer, branch, gel, _ = group_booking_context
    appointment = datetime.combine(datetime.now(ZoneInfo("Asia/Manila")).date() + timedelta(days=1), time(11), ZoneInfo("Asia/Manila"))
    payload = GroupBookingCreateRequest(branch_id=branch.id, appointment_date=appointment,
                                        members=[{"name": "Friend", "service_ids": [gel.id, gel.id]}],
                                        booker_service_ids=[gel.id])
    booking = create_customer_group_appointment(payload, current_user=customer, db=db)
    stored_booking = db.query(Booking).filter_by(id=booking.id).first()
    stored_booking.status = "confirmed"
    db.commit()
    staff = db.query(User).filter(User.role == "staff", User.branch_id == branch.id).first()
    items = db.query(BookingServiceItem).filter_by(booking_id=booking.id).order_by(BookingServiceItem.id).all()
    monkeypatch.setattr(transaction_routes, "_require_appointment_day", lambda _booking: None)

    transaction_routes.update_group_service_status(booking.id, items[0].id,
        BookingServiceItemStatusRequest(status="completed"), current_user=staff, db=db)
    transaction_routes.update_group_service_status(booking.id, items[1].id,
        BookingServiceItemStatusRequest(status="cancelled"), current_user=staff, db=db)

    db.refresh(stored_booking)
    assert stored_booking.status == "confirmed"
    assert items[0].status == "completed"
    assert items[1].status == "cancelled"
    assert items[2].status == "pending"
