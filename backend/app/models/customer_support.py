from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CustomerSupportThread(Base):
    __tablename__ = "customer_support_threads"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(120), nullable=False)
    status = Column(String(20), nullable=False, default="open", server_default="open", index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    customer = relationship("User", foreign_keys=[customer_id])
    branch = relationship("Branch")
    messages = relationship(
        "CustomerSupportMessage",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CustomerSupportMessage.created_at",
    )


class CustomerSupportMessage(Base):
    __tablename__ = "customer_support_messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("customer_support_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    thread = relationship("CustomerSupportThread", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class CustomerProfileChangeRequest(Base):
    __tablename__ = "customer_profile_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    field = Column(String(20), nullable=False)
    current_value = Column(String(255), nullable=True)
    requested_value = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending", index=True)
    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    manager_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    reviewed_at = Column(DateTime, nullable=True)

    customer = relationship("User", foreign_keys=[customer_id])
    branch = relationship("Branch")
    manager = relationship("User", foreign_keys=[manager_id])
