from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes.customer import (
    create_customer_appointment,
    list_customer_branch_providers,
)
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


def test_customer_can_request_branch_specialist_without_assigning_them(booking_context):
    session, customer, branch, service, preferred, _ = booking_context
    result = create_customer_appointment(
        BookingCreateRequest(
            branch_id=branch.id,
            service_id=service.id,
            preferred_service_provider_id=preferred.id,
            appointment_date=datetime.now() + timedelta(days=1),
        ),
        current_user=customer,
        db=session,
    )

    assert result.preferred_service_provider.id == preferred.id
    assert result.service_provider is None
    providers = list_customer_branch_providers(branch.id, current_user=customer, db=session)
    assert providers == [{"id": preferred.id, "full_name": "Ana Cruz", "job_title": "Nail Technician"}]


def test_customer_cannot_request_provider_from_another_branch(booking_context):
    session, customer, branch, service, _, wrong_branch_provider = booking_context
    with pytest.raises(HTTPException) as exc_info:
        create_customer_appointment(
            BookingCreateRequest(
                branch_id=branch.id,
                service_id=service.id,
                preferred_service_provider_id=wrong_branch_provider.id,
                appointment_date=datetime.now() + timedelta(days=1),
            ),
            current_user=customer,
            db=session,
        )

    assert exc_info.value.status_code == 400
