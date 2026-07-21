from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.transaction import Transaction


def create_transaction(
    db: Session,
    booking: Booking,
    staff_id: int,
    amount: Optional[float],
    payment_method: str,
    service_provider_id: Optional[int] = None,
    additional_charge: float = 0,
    charge_reason: Optional[str] = None,
    commission_rate: float = 0,
    commission_amount: float = 0,
) -> Transaction:
    final_amount = amount if amount is not None else booking.service.price

    transaction = Transaction(
        booking_id=booking.id,
        staff_id=staff_id,
        amount=final_amount,
        payment_method=payment_method,
        service_provider_id=service_provider_id,
        additional_charge=additional_charge,
        charge_reason=charge_reason,
        commission_rate=commission_rate,
        commission_amount=commission_amount,
    )
    db.add(transaction)

    # Recording payment implies the service was rendered.
    booking.status = "completed"
    if service_provider_id:
        booking.service_provider_id = service_provider_id

    db.commit()
    db.refresh(transaction)
    return transaction


def get_transactions_for_branch(
    db: Session,
    branch_id: int,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Transaction], int]:
    query = (
        db.query(Transaction)
        .join(Booking, Transaction.booking_id == Booking.id)
        .options(
            joinedload(Transaction.booking).joinedload(Booking.customer),
            joinedload(Transaction.booking).joinedload(Booking.service),
            joinedload(Transaction.staff),
            joinedload(Transaction.service_provider),
        )
        .filter(Booking.branch_id == branch_id)
    )

    total = query.count()

    transactions = (
        query.order_by(Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return transactions, total
