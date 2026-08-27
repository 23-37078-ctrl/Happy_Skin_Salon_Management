from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes.customer import create_customer_appointment
from app.core.database import Base
from app.models.branch import Branch
from app.models.service import Service
from app.models.user import User
from app.schemas.booking import BookingCreateRequest


@pytest.fixture()
def booking_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    branch = Branch(name="Main", address="Main Street", is_active=True)
    other_branch = Branch(name="North", address="North Street", is_active=True)
    service = Service(name="Manicure", price=500, duration_minutes=60, is_active=True)
    branch.services.append(service)
    customer = User(full_name="Customer", email="customer@example.com", role="customer")
    preferred = User(full_name="Ana Cruz", email="ana@example.com", role="staff", branch_id=None, job_title="Nail Technician")
    wrong_branch_provider = User(full_name="Other Staff", email="other@example.com", role="staff", branch_id=None, job_title="Nail Technician")
    session.add_all([branch, other_branch, customer, preferred, wrong_branch_provider])
    session.flush()
    preferred.branch_id = branch.id
    wrong_branch_provider.branch_id = other_branch.id
    session.commit()

    yield session, customer, branch, service, preferred, wrong_branch_provider
    session.close()
    engine.dispose()


def _tomorrow_at_ten():
    tomorrow = datetime.now(ZoneInfo("Asia/Manila")).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time(10, 0), ZoneInfo("Asia/Manila"))


def test_customer_booking_does_not_request_or_assign_specialist(booking_context):
    session, customer, branch, service, _, _ = booking_context
    result = create_customer_appointment(
        BookingCreateRequest(
            branch_id=branch.id,
            service_id=service.id,
            appointment_date=_tomorrow_at_ten(),
        ),
        current_user=customer,
        db=session,
    )

    assert result.preferred_service_provider is None
    assert result.service_provider is None


def test_customer_cannot_book_a_full_time_slot(booking_context):
    session, customer, branch, service, _, _ = booking_context
    payload = BookingCreateRequest(
        branch_id=branch.id,
        service_id=service.id,
        appointment_date=_tomorrow_at_ten(),
    )
    create_customer_appointment(payload, current_user=customer, db=session)

    with pytest.raises(HTTPException) as exc_info:
        create_customer_appointment(payload, current_user=customer, db=session)

    assert exc_info.value.status_code == 409
