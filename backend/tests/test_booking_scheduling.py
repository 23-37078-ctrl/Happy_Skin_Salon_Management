from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.service import Service
from app.models.user import User
from app.api.v1.routes.transactions import create_walk_in_booking
from app.schemas.transaction import WalkInBookingRequest
from app.services.booking_scheduling import BUSINESS_TIMEZONE, validate_booking_schedule


@pytest.fixture()
def schedule_context():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    branch = Branch(name="Main", address="Main Street", is_active=True)
    service = Service(name="Long treatment", price=1000, duration_minutes=60, is_active=True)
    first = User(full_name="Staff One", email="staff1@example.com", role="staff", branch_id=1, job_title="Stylist", is_active=True)
    second = User(full_name="Staff Two", email="staff2@example.com", role="staff", branch_id=1, job_title="Stylist", is_active=True)
    db.add_all([branch, service, first, second])
    db.flush()
    branch.services.append(service)
    first.branch_id = second.branch_id = branch.id
    db.commit()
    yield db, branch, service, first, second
    db.close()
    engine.dispose()


def future_slot(hour=11, minute=0):
    day = datetime.now(BUSINESS_TIMEZONE).date() + timedelta(days=1)
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=BUSINESS_TIMEZONE)


def test_online_guest_and_registered_schedule_use_staff_capacity(schedule_context):
    db, branch, service, first, second = schedule_context
    start = future_slot()
    # The same shared validation used by guest and registered booking accepts
    # concurrent starts only when separate staff members can cover the duration.
    assert validate_booking_schedule(db, branch.id, start, [service], online=True) == [first.id]
    existing = Booking(branch_id=branch.id, service_id=service.id, service_provider_id=first.id,
                       appointment_date=start.astimezone(timezone.utc), status="pending")
    db.add(existing)
    db.commit()
    assert validate_booking_schedule(db, branch.id, start, [service], online=True) == [second.id]
    another = Booking(branch_id=branch.id, service_id=service.id, service_provider_id=second.id,
                      appointment_date=start.astimezone(timezone.utc), status="confirmed")
    db.add(another)
    db.commit()
    with pytest.raises(HTTPException) as unavailable:
        validate_booking_schedule(db, branch.id, start, [service], online=True)
    assert unavailable.value.status_code == 409


def test_walk_in_uses_selected_staff_conflict_validation(schedule_context):
    db, branch, service, first, second = schedule_context
    start = future_slot()
    existing = Booking(branch_id=branch.id, service_id=service.id, service_provider_id=first.id,
                       appointment_date=start.astimezone(timezone.utc), status="confirmed")
    db.add(existing)
    db.commit()
    assert validate_booking_schedule(db, branch.id, start, [service], online=False,
                                     requested_provider_ids={service.id: second.id}) == [second.id]
    with pytest.raises(HTTPException) as conflict:
        validate_booking_schedule(db, branch.id, start, [service], online=False,
                                  requested_provider_ids={service.id: first.id})
    assert conflict.value.status_code == 409


def test_staff_walk_in_endpoint_records_only_a_valid_available_provider(schedule_context):
    db, branch, service, first, _second = schedule_context
    payload = WalkInBookingRequest(
        customer_name="Walk In Client", phone_number="09171234567", service_id=service.id,
        service_provider_id=first.id, service_ids=[service.id], service_provider_ids={service.id: first.id},
        appointment_date=future_slot(),
    )
    created = create_walk_in_booking(payload, first, db)
    assert created["status"] == "confirmed"
    booking = db.query(Booking).filter_by(branch_id=branch.id, customer_id=created["customer"]["id"]).one()
    assert booking.service_items[0].service_provider_id == first.id

    duplicate = payload.model_copy(update={"customer_name": "Another Walk In", "phone_number": "09171234568"})
    with pytest.raises(HTTPException) as conflict:
        create_walk_in_booking(duplicate, first, db)
    assert conflict.value.status_code == 409


def test_service_duration_must_finish_before_closing(schedule_context):
    db, branch, _service, _first, _second = schedule_context
    service = Service(id=999, name="Long treatment", price=1000, duration_minutes=90, is_active=True)
    with pytest.raises(HTTPException) as too_late:
        validate_booking_schedule(db, branch.id, future_slot(20, 0), [service], online=True)
    assert too_late.value.status_code == 400
    assert "after the salon closes" in too_late.value.detail


def test_past_walk_in_time_is_rejected(schedule_context):
    db, branch, service, _first, first = schedule_context
    past = datetime(2020, 1, 1, 11, 0, tzinfo=BUSINESS_TIMEZONE)
    with pytest.raises(HTTPException) as error:
        validate_booking_schedule(db, branch.id, past, [service], online=False,
                                  requested_provider_ids={service.id: first.id})
    assert error.value.status_code == 400
    assert "past" in error.value.detail
