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
) -> Transaction:
    final_amount = amount if amount is not None else booking.service.price

    transaction = Transaction(
        booking_id=booking.id,
        staff_id=staff_id,
        amount=final_amount,
        payment_method=payment_method,
    )
    db.add(transaction)

    # Recording payment implies the service was rendered.
    booking.status = "completed"

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
            joinedload(Transaction.booking),
            joinedload(Transaction.staff),
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