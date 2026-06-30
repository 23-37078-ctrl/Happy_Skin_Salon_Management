from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id                        = Column(Integer, primary_key=True, index=True)
    full_name                 = Column(String(100), nullable=False)
    email                     = Column(String(255), unique=True, index=True, nullable=False)
    password_hash             = Column(String(255), nullable=False)
    role                      = Column(String(20), default="customer", nullable=False)
    branch_id                 = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # ── Contact ───────────────────────────────────────────────
    phone_number              = Column(String(20), nullable=True)   # e.g. 09171234567

    # ── OTP preference: "email" or "sms" ─────────────────────
    otp_method                = Column(String(10), default="email", nullable=False)

    # ── Verification ──────────────────────────────────────────
    email_verified            = Column(Boolean, default=False, nullable=False)
    verification_code         = Column(String(6), nullable=True)
    verification_code_expires = Column(DateTime, nullable=True)
    verified_at               = Column(DateTime, nullable=True)

    created_at                = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at                = Column(DateTime, server_default=func.now(), onupdate=func.now())