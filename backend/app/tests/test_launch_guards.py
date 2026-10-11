import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes.auth import _check_otp_attempts
from app.core.config import Settings
from app.core.database import Base
from app.models.branch import Branch
from app.models.booking import Booking
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreateRequest, WalkInCheckoutRequest


def test_otp_verification_locks_after_maximum_attempts():
    user = User(verification_attempts=5)
    with pytest.raises(HTTPException) as error:
        _check_otp_attempts(user)
    assert error.value.status_code == 429


def test_production_settings_reject_default_secret_and_local_database():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="change-this-to-a-long-random-secret",
            DATABASE_URL="postgresql://user:pass@localhost/db",
            CORS_ORIGINS="https://salon.example",
        )


def test_payment_requests_require_an_idempotency_key():
    with pytest.raises(ValidationError):
        TransactionCreateRequest(booking_id=1)
    with pytest.raises(ValidationError):
        WalkInCheckoutRequest(
            customer_name="Client",
            service_id=1,
            service_provider_id=1,
        )


def test_database_rejects_a_second_transaction_for_one_booking():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    branch = Branch(name="Main", address="Main Street")
    service = Service(name="Manicure", price=500, duration_minutes=60)
    customer = User(full_name="Client", email="client@example.com", role="customer")
    staff = User(full_name="Staff", email="staff@example.com", role="staff")
    session.add_all([branch, service, customer, staff])
    session.flush()
    branch.services.append(service)
    booking = Booking(
        customer_id=customer.id,
        branch_id=branch.id,
        service_id=service.id,
        appointment_date=datetime(2026, 10, 12, 10, 0),
        status="treatment_done",
    )
    session.add(booking)
    session.flush()
    session.add(Transaction(booking_id=booking.id, staff_id=staff.id, amount=500))
    session.commit()

    session.add(Transaction(booking_id=booking.id, staff_id=staff.id, amount=500))
    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()
    session.close()
    engine.dispose()
from datetime import datetime

