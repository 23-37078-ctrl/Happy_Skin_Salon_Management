from datetime import datetime, timezone
import asyncio
from io import BytesIO

from fastapi import UploadFile, HTTPException
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes import customer as customer_routes, transactions as transaction_routes
from app.core.database import Base
from app.models.booking import Booking
from app.models.booking_payment import BookingPayment
from app.models.booking_payment_attempt import BookingPaymentAttempt
from app.models.gcash_payment_submission import GCashPaymentSubmission
from app.models.customer_notification import CustomerNotificationRead
from app.models.branch import Branch
from app.models.service import Service
from app.models.transaction import Transaction
from app.models.user import User
from app.core.config import settings


@pytest.fixture()
def gcash_context(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    branch = Branch(name="Main", address="Main Street", is_active=True)
    service = Service(name="Facial", price=1200, duration_minutes=60, is_active=True)
    customer = User(full_name="Client", email="client@example.com", role="customer")
    staff = User(full_name="Staff", email="staff@example.com", role="staff", branch_id=1)
    session.add_all([branch, service, customer]); session.flush()
    staff.branch_id = branch.id
    session.add(staff)
    booking = Booking(customer_id=customer.id, branch_id=branch.id, service_id=service.id,
                      appointment_date=datetime(2027, 1, 10, 10), status="pending")
    session.add(booking); session.flush()
    payment = BookingPayment(booking_id=booking.id, provider="gcash", reference_number=f"HS-{booking.id}-test",
                             status="pending", amount=1200)
    session.add(payment); session.flush()
    attempt = BookingPaymentAttempt(booking_payment_id=payment.id, paypal_order_id="ORDER-GCASH-TEST",
        create_request_id="create-gcash-test", status="pending", amount=1200, currency="PHP")
    session.add(attempt); session.commit()
    monkeypatch.setattr(customer_routes.settings, "GCASH_PROOF_STORAGE_PATH", str(__import__("tempfile").mkdtemp()))
    yield session, booking, payment, customer, staff
    session.close(); engine.dispose()


def test_gcash_proof_stays_for_verification_until_staff_approves(gcash_context):
    db, booking, payment, customer, staff = gcash_context
    upload = UploadFile(filename="proof.png", file=BytesIO(b"\x89PNG\r\n\x1a\n" + b"proof"))
    result = asyncio.run(customer_routes.submit_gcash_proof(
        booking.id, "GC123456789", upload, datetime.now(timezone.utc), None, customer, db,
    ))
    assert result["status"] == "for_verification"
    assert db.get(BookingPayment, payment.id).status == "for_verification"
    assert db.query(BookingPaymentAttempt).filter_by(paypal_order_id="ORDER-GCASH-TEST").one().status == "cancelled"
    assert db.query(Transaction).filter_by(booking_id=booking.id).count() == 0

    submission = db.query(GCashPaymentSubmission).one()
    response = transaction_routes.decide_gcash_proof(
        submission.id, {"decision": "approved", "remarks": "Matched merchant wallet record."}, staff, db,
    )
    assert response["status"] == "paid"
    assert db.query(Transaction).filter_by(booking_id=booking.id).count() == 1
    with pytest.raises(HTTPException) as error:
        transaction_routes.decide_gcash_proof(
            submission.id, {"decision": "rejected", "remarks": "duplicate"}, staff, db,
        )
    assert error.value.status_code == 409


def test_invalid_screenshot_and_foreign_staff_proof_access_are_rejected(gcash_context):
    db, booking, payment, customer, _staff = gcash_context
    bad_upload = UploadFile(filename="proof.png", file=BytesIO(b"not an image"))
    with pytest.raises(HTTPException) as invalid_file:
        asyncio.run(customer_routes.submit_gcash_proof(
            booking.id, "GC123456789", bad_upload, datetime.now(timezone.utc), None, customer, db,
        ))
    assert invalid_file.value.status_code == 415

    good_upload = UploadFile(filename="proof.png", file=BytesIO(b"\x89PNG\r\n\x1a\nproof"))
    asyncio.run(customer_routes.submit_gcash_proof(
        booking.id, "GC123456789", good_upload, datetime.now(timezone.utc), None, customer, db,
    ))
    submission = db.query(GCashPaymentSubmission).one()
    other_branch = Branch(name="Other", address="Other Street", is_active=True)
    db.add(other_branch); db.flush()
    other_staff = User(full_name="Other staff", email="other@example.com", role="staff", branch_id=other_branch.id)
    db.add(other_staff); db.commit()
    with pytest.raises(HTTPException) as forbidden:
        transaction_routes.gcash_verification_proof(submission.id, other_staff, db)
    assert forbidden.value.status_code == 404
    with pytest.raises(HTTPException) as forbidden_decision:
        transaction_routes.decide_gcash_proof(
            submission.id, {"decision": "approved", "remarks": "untrusted"}, other_staff, db,
        )
    assert forbidden_decision.value.status_code == 404
    assert db.get(BookingPayment, payment.id).status == "for_verification"


def test_oversized_proof_and_non_owner_submission_are_rejected(gcash_context, monkeypatch):
    db, booking, payment, customer, _staff = gcash_context
    monkeypatch.setattr(settings, "GCASH_PROOF_MAX_BYTES", 16)
    oversized = UploadFile(filename="large.png", file=BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * 20))
    with pytest.raises(HTTPException) as too_large:
        asyncio.run(customer_routes.submit_gcash_proof(
            booking.id, "GC123456789", oversized, datetime.now(timezone.utc), None, customer, db,
        ))
    assert too_large.value.status_code == 413

    other_customer = User(full_name="Other client", email="other-client@example.com", role="customer")
    db.add(other_customer); db.commit()
    valid = UploadFile(filename="proof.png", file=BytesIO(b"\x89PNG\r\n\x1a\nproof"))
    with pytest.raises(HTTPException) as not_owner:
        asyncio.run(customer_routes.submit_gcash_proof(
            booking.id, "GC123456789", valid, datetime.now(timezone.utc), None, other_customer, db,
        ))
    assert not_owner.value.status_code == 404
    assert db.get(BookingPayment, payment.id).status == "pending"


def test_rejection_keeps_reason_and_staff_audit(gcash_context):
    db, booking, payment, customer, staff = gcash_context
    upload = UploadFile(filename="proof.png", file=BytesIO(b"\x89PNG\r\n\x1a\nproof"))
    asyncio.run(customer_routes.submit_gcash_proof(
        booking.id, "GC123456789", upload, datetime.now(timezone.utc), None, customer, db,
    ))
    submission = db.query(GCashPaymentSubmission).one()
    result = transaction_routes.decide_gcash_proof(
        submission.id, {"decision": "rejected", "remarks": "Reference is absent from merchant transaction history."}, staff, db,
    )
    db.refresh(submission); db.refresh(payment)
    assert result["status"] == "rejected"
    assert submission.decision == "rejected"
    assert submission.decided_by_id == staff.id and submission.decided_at is not None
    assert payment.decision_remarks == submission.remarks
    assert db.query(Transaction).filter_by(booking_id=booking.id).count() == 0


def test_payment_notification_can_be_marked_read_only_by_its_customer(gcash_context):
    db, booking, payment, customer, _staff = gcash_context
    payment.status = "for_verification"
    db.commit()
    notification_id = f"payment-{payment.id}-for_verification"
    other_customer = User(full_name="Other client", email="other-notify@example.com", role="customer")
    db.add(other_customer); db.commit()
    with pytest.raises(HTTPException) as forbidden:
        customer_routes.mark_customer_notification_read(notification_id, other_customer, db)
    assert forbidden.value.status_code == 404
    result = customer_routes.mark_customer_notification_read(notification_id, customer, db)
    assert result["is_read"] is True
    assert db.query(CustomerNotificationRead).filter_by(customer_id=customer.id, notification_id=notification_id).count() == 1


def test_duplicate_gcash_reference_is_rejected(gcash_context):
    db, booking, payment, customer, _staff = gcash_context
    second_booking = Booking(customer_id=customer.id, branch_id=booking.branch_id, service_id=booking.service_id,
        appointment_date=datetime(2027, 1, 11, 10), status="pending")
    db.add(second_booking); db.flush()
    db.add(BookingPayment(booking_id=second_booking.id, provider="gcash", reference_number="HS-second-test", status="pending", amount=1200))
    db.commit()
    image = b"\x89PNG\r\n\x1a\nproof"
    upload = UploadFile(filename="proof.png", file=BytesIO(image))
    asyncio.run(customer_routes.submit_gcash_proof(booking.id, "GC123456789", upload, datetime.now(timezone.utc), None, customer, db))
    upload = UploadFile(filename="proof.png", file=BytesIO(image))
    with pytest.raises(HTTPException) as error:
        asyncio.run(customer_routes.submit_gcash_proof(second_booking.id, "GC123456789", upload, datetime.now(timezone.utc), None, customer, db))
    assert error.value.status_code == 409
