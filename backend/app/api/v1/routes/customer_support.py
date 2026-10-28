import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.permissions import require_role
from app.models.branch import Branch
from app.models.customer_support import CustomerProfileChangeRequest, CustomerSupportMessage, CustomerSupportThread
from app.models.user import User

customer_router = APIRouter(prefix="/customer", tags=["Customer support"])
owner_router = APIRouter(prefix="/owner", tags=["Owner customer support"])


class EmailChangeRequest(BaseModel):
    branch_id: int | None = Field(default=None, gt=0)
    requested_value: str = Field(min_length=3, max_length=255)


class ThreadCreate(BaseModel):
    branch_id: int = Field(gt=0)
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=1, max_length=4000)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ManagerThreadUpdate(BaseModel):
    subject: str | None = Field(default=None, min_length=3, max_length=120)
    status: Literal["open", "closed"] | None = None


class ChangeReview(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    manager_note: str | None = Field(default=None, max_length=1000)


def _customer(user: User):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer access required.")


def _active_branch(db: Session, branch_id: int):
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.is_active.is_(True)).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Choose an active branch.")
    return branch


def _profile_request_branch(db: Session, branch_id: int | None = None):
    if branch_id:
        return _active_branch(db, branch_id)
    branches = db.query(Branch).filter(Branch.is_active.is_(True)).order_by(Branch.id.asc()).all()
    branch = next((item for item in branches if "main" in (item.name or "").lower()), None)
    if branch:
        return branch
    if branches:
        return branches[0]
    raise HTTPException(status_code=404, detail="No active branch is available to assign this request.")


def _serialize_request(row: CustomerProfileChangeRequest):
    return {"id": row.id, "field": row.field, "current_value": row.current_value,
            "requested_value": row.requested_value, "status": row.status,
            "branch_id": row.branch_id, "branch_name": row.branch.name if row.branch else None,
            "manager_note": row.manager_note, "created_at": row.created_at,
            "reviewed_at": row.reviewed_at,
            "customer": {"id": row.customer.id, "full_name": row.customer.full_name, "email": row.customer.email,
                         "phone_number": row.customer.phone_number} if row.customer else None}


def _serialize_message(row: CustomerSupportMessage):
    return {"id": row.id, "sender_id": row.sender_id, "sender_role": row.sender_role,
            "sender_name": row.sender.full_name if row.sender else "", "body": row.body, "created_at": row.created_at}


def _serialize_thread(row: CustomerSupportThread, include_messages=False):
    result = {"id": row.id, "customer_id": row.customer_id, "customer_name": row.customer.full_name if row.customer else "Customer",
              "branch_id": row.branch_id, "branch_name": row.branch.name if row.branch else "",
              "subject": row.subject, "status": row.status, "created_at": row.created_at,
              "updated_at": row.updated_at}
    if include_messages:
        result["messages"] = [_serialize_message(message) for message in row.messages]
    return result


def _load_thread(db: Session, thread_id: int):
    return db.query(CustomerSupportThread).options(
        joinedload(CustomerSupportThread.customer), joinedload(CustomerSupportThread.branch),
        joinedload(CustomerSupportThread.messages).joinedload(CustomerSupportMessage.sender),
    ).filter(CustomerSupportThread.id == thread_id).first()


@customer_router.post("/profile/change-requests")
def request_email_change(payload: EmailChangeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _customer(user)
    branch = _profile_request_branch(db, payload.branch_id)
    email = payload.requested_value.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if email == user.email.lower():
        raise HTTPException(status_code=409, detail="That email is already on your account.")
    if db.query(User).filter(User.email == email, User.id != user.id).first():
        raise HTTPException(status_code=409, detail="That email is already used by another account.")
    pending = db.query(CustomerProfileChangeRequest).filter_by(customer_id=user.id, field="email", status="pending").first()
    if pending:
        raise HTTPException(status_code=409, detail="You already have an email change request waiting for owner review.")
    row = CustomerProfileChangeRequest(customer_id=user.id, branch_id=branch.id, field="email",
        current_value=user.email, requested_value=email, status="pending")
    db.add(row)
    db.commit()
    row = db.query(CustomerProfileChangeRequest).options(joinedload(CustomerProfileChangeRequest.branch), joinedload(CustomerProfileChangeRequest.customer)).get(row.id)
    return _serialize_request(row)


@customer_router.get("/profile/change-requests")
def customer_change_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _customer(user)
    rows = db.query(CustomerProfileChangeRequest).options(joinedload(CustomerProfileChangeRequest.branch), joinedload(CustomerProfileChangeRequest.customer)).filter(
        CustomerProfileChangeRequest.customer_id == user.id).order_by(CustomerProfileChangeRequest.created_at.desc()).limit(50).all()
    return {"requests": [_serialize_request(row) for row in rows]}


@customer_router.get("/support/threads")
def customer_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _customer(user)
    rows = db.query(CustomerSupportThread).options(joinedload(CustomerSupportThread.customer), joinedload(CustomerSupportThread.branch)).filter(
        CustomerSupportThread.customer_id == user.id).order_by(CustomerSupportThread.updated_at.desc()).all()
    return {"threads": [_serialize_thread(row) for row in rows]}


@customer_router.post("/support/threads")
def create_customer_thread(payload: ThreadCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _customer(user)
    branch = _active_branch(db, payload.branch_id)
    thread = CustomerSupportThread(customer_id=user.id, branch_id=branch.id, subject=payload.subject.strip(), status="open")
    db.add(thread)
    db.flush()
    db.add(CustomerSupportMessage(thread_id=thread.id, sender_id=user.id, sender_role="customer", body=payload.message.strip()))
    db.commit()
    return _serialize_thread(_load_thread(db, thread.id), include_messages=True)


@customer_router.get("/support/threads/{thread_id}")
def get_customer_thread(thread_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _customer(user)
    thread = _load_thread(db, thread_id)
    if not thread or thread.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return _serialize_thread(thread, include_messages=True)


@customer_router.post("/support/threads/{thread_id}/messages")
def customer_message(thread_id: int, payload: MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _customer(user)
    thread = _load_thread(db, thread_id)
    if not thread or thread.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if thread.status == "closed":
        raise HTTPException(status_code=409, detail="This conversation is closed.")
    db.add(CustomerSupportMessage(thread_id=thread.id, sender_id=user.id, sender_role="customer", body=payload.body.strip()))
    thread.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_thread(_load_thread(db, thread.id), include_messages=True)


@owner_router.get("/profile-change-requests")
def owner_change_requests(status_filter: str | None = None, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    query = db.query(CustomerProfileChangeRequest).options(joinedload(CustomerProfileChangeRequest.branch), joinedload(CustomerProfileChangeRequest.customer))
    if status_filter in {"pending", "approved", "rejected"}:
        query = query.filter(CustomerProfileChangeRequest.status == status_filter)
    rows = query.order_by(CustomerProfileChangeRequest.created_at.desc()).limit(200).all()
    return {"requests": [_serialize_request(row) for row in rows]}


@owner_router.patch("/profile-change-requests/{request_id}")
def review_change_request(request_id: int, payload: ChangeReview, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    row = db.query(CustomerProfileChangeRequest).options(joinedload(CustomerProfileChangeRequest.customer), joinedload(CustomerProfileChangeRequest.branch)).filter(
        CustomerProfileChangeRequest.id == request_id,
    ).with_for_update(of=CustomerProfileChangeRequest).first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact change request not found.")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been reviewed.")
    if payload.decision == "approved":
        duplicate = db.query(User).filter(User.id != row.customer_id, getattr(User, row.field) == row.requested_value).first()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"That {row.field.replace('_', ' ')} is now used by another account.")
        if row.field == "email":
            row.customer.email = row.requested_value
        elif row.field == "phone_number":
            row.customer.phone_number = row.requested_value
            row.customer.phone_verified = True
            row.customer.otp_method = "sms"
            row.customer.verified_at = datetime.utcnow()
        else:
            raise HTTPException(status_code=400, detail="Unsupported profile field.")
    row.status = payload.decision
    row.manager_id = user.id
    row.manager_note = payload.manager_note.strip() if payload.manager_note else None
    row.reviewed_at = datetime.utcnow()
    db.commit()
    row = db.query(CustomerProfileChangeRequest).options(joinedload(CustomerProfileChangeRequest.branch), joinedload(CustomerProfileChangeRequest.customer)).get(row.id)
    return _serialize_request(row)


@owner_router.get("/support/threads")
def owner_threads(user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    rows = db.query(CustomerSupportThread).options(joinedload(CustomerSupportThread.customer), joinedload(CustomerSupportThread.branch)).order_by(CustomerSupportThread.updated_at.desc()).limit(500).all()
    return {"threads": [_serialize_thread(row) for row in rows]}


@owner_router.get("/support/threads/{thread_id}")
def get_owner_thread(thread_id: int, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    thread = _load_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return _serialize_thread(thread, include_messages=True)


@owner_router.patch("/support/threads/{thread_id}")
def update_owner_thread(thread_id: int, payload: ManagerThreadUpdate, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    thread = db.query(CustomerSupportThread).filter(CustomerSupportThread.id == thread_id).with_for_update().first()
    if not thread:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if payload.subject is None and payload.status is None:
        raise HTTPException(status_code=422, detail="Update the concern title or conversation status.")
    if payload.subject is not None:
        thread.subject = payload.subject.strip()
    if payload.status is not None:
        thread.status = payload.status
    thread.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_thread(_load_thread(db, thread.id), include_messages=True)


@owner_router.post("/support/threads/{thread_id}/messages")
def owner_message(thread_id: int, payload: MessageCreate, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    thread = _load_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if thread.status == "closed":
        raise HTTPException(status_code=409, detail="This conversation is closed.")
    db.add(CustomerSupportMessage(thread_id=thread.id, sender_id=user.id, sender_role="owner", body=payload.body.strip()))
    thread.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_thread(_load_thread(db, thread.id), include_messages=True)
