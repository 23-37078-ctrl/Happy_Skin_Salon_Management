from datetime import datetime

import pytest
from fastapi import HTTPException
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes import customer as customer_routes
from app.core.database import Base
from app.models.booking import Booking
from app.models.booking_payment import BookingPayment
from app.models.booking_payment_attempt import BookingPaymentAttempt
from app.models.branch import Branch
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User


@pytest.fixture()
def payment_context(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    branch = Branch(name="Main", address="Main Street", is_active=True)
    service = Service(name="Facial", price=1200.00, duration_minutes=60, is_active=True)
    customer = User(full_name="Client", email="client@example.com", role="customer")
    session.add_all([branch, service, customer])
    session.flush()
    branch.services.append(service)
    booking = Booking(customer_id=customer.id, branch_id=branch.id, service_id=service.id,
                      appointment_date=datetime(2027, 1, 10, 10), status="pending")
    session.add(booking)
    session.flush()
    payment = BookingPayment(booking_id=booking.id, provider="paypal", reference_number="HS-1-test",
                             status="pending", amount=1200, payment_method=None)
    session.add(payment)
    session.flush()
    attempt = BookingPaymentAttempt(booking_payment_id=payment.id, paypal_order_id="ORDER-1",
                                   create_request_id="create-1", status="pending", amount=1200,
                                   currency="PHP")
    session.add(attempt)
    session.commit()
    monkeypatch.setattr(customer_routes, "_send_booking_receipt_sms", lambda *args: True)
    yield session, booking.id, payment.id, attempt.id
    session.close()
    engine.dispose()


def _completed_order(capture_id="CAPTURE-1", amount="1200.00", currency="PHP", capture_status="COMPLETED"):
    return {
        "id": "ORDER-1",
        "status": "COMPLETED",
        "purchase_units": [{"payments": {"captures": [{
            "id": capture_id,
            "status": capture_status,
            "amount": {"value": amount, "currency_code": currency},
        }]}}],
    }


def test_verified_capture_records_one_paypal_transaction_and_is_idempotent(payment_context):
    db, booking_id, payment_id, attempt_id = payment_context
    attempt = db.get(BookingPaymentAttempt, attempt_id)
    payment = db.get(BookingPayment, payment_id)
    booking = db.get(Booking, booking_id)

    result = customer_routes._record_paypal_capture(db, attempt, payment, booking, _completed_order())
    assert result == {"status": "paid", "booking_id": booking_id, "capture_id": "CAPTURE-1"}
    assert booking.status == "pending"
    assert payment.status == "paid"
    assert payment.payment_method == "paypal"
    assert payment.payment_id == "CAPTURE-1"
    assert db.query(Transaction).filter_by(booking_id=booking_id).count() == 1

    result = customer_routes._record_paypal_capture(
        db, db.get(BookingPaymentAttempt, attempt_id), db.get(BookingPayment, payment_id),
        db.get(Booking, booking_id), _completed_order()
    )
    assert result["status"] == "paid"
    assert db.query(Transaction).filter_by(booking_id=booking_id).count() == 1


@pytest.mark.parametrize(("amount", "currency"), [("1199.99", "PHP"), ("1200.00", "USD")])
def test_capture_amount_or_currency_mismatch_never_marks_paid(payment_context, amount, currency):
    db, booking_id, payment_id, attempt_id = payment_context
    with pytest.raises(HTTPException) as error:
        customer_routes._record_paypal_capture(
            db, db.get(BookingPaymentAttempt, attempt_id), db.get(BookingPayment, payment_id),
            db.get(Booking, booking_id), _completed_order(amount=amount, currency=currency)
        )
    assert error.value.status_code == 400
    db.expire_all()
    assert db.get(BookingPayment, payment_id).status == "pending"
    assert db.query(Transaction).filter_by(booking_id=booking_id).count() == 0


def test_declined_capture_marks_only_attempt_failed(payment_context):
    db, booking_id, payment_id, attempt_id = payment_context
    with pytest.raises(HTTPException) as error:
        customer_routes._record_paypal_capture(
            db, db.get(BookingPaymentAttempt, attempt_id), db.get(BookingPayment, payment_id),
            db.get(Booking, booking_id), _completed_order(capture_status="DENIED")
        )
    assert error.value.status_code == 402
    db.expire_all()
    assert db.get(BookingPaymentAttempt, attempt_id).status == "failed"
    assert db.get(BookingPayment, payment_id).status == "pending"
    assert db.query(Transaction).filter_by(booking_id=booking_id).count() == 0


def test_late_completed_capture_is_recorded_without_reopening_cancelled_booking(payment_context):
    db, booking_id, payment_id, attempt_id = payment_context
    db.get(Booking, booking_id).status = "cancelled"
    db.get(BookingPayment, payment_id).status = "cancelled"
    db.get(BookingPaymentAttempt, attempt_id).status = "cancelled"
    db.commit()

    customer_routes._record_paypal_capture(
        db, db.get(BookingPaymentAttempt, attempt_id), db.get(BookingPayment, payment_id),
        db.get(Booking, booking_id), _completed_order()
    )
    db.expire_all()
    assert db.get(Booking, booking_id).status == "cancelled"
    assert db.get(BookingPayment, payment_id).status == "paid"
    assert db.query(Transaction).filter_by(booking_id=booking_id).count() == 1


def test_customer_ownership_and_guest_token_are_separate(payment_context):
    db, booking_id, payment_id, _ = payment_context
    booking = db.get(Booking, booking_id)
    payment = db.get(BookingPayment, payment_id)
    owner = db.get(User, booking.customer_id)
    other_customer = User(full_name="Other", email="other@example.com", role="customer")
    db.add(other_customer)
    db.commit()

    customer_routes._payment_for_customer(db, booking_id, owner, None)
    with pytest.raises(HTTPException) as error:
        customer_routes._payment_for_customer(db, booking_id, other_customer, None)
    assert error.value.status_code == 404

    guest_token = "guest-test-token-with-sufficient-length"
    payment.guest_status_token_hash = hashlib.sha256(guest_token.encode()).hexdigest()
    booking.customer_id = None
    db.commit()
    customer_routes._payment_for_customer(db, booking_id, None, guest_token)
    with pytest.raises(HTTPException) as error:
        customer_routes._payment_for_customer(db, booking_id, None, "wrong-token-with-sufficient-length")
    assert error.value.status_code == 404
