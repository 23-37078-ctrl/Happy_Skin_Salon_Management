import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import (
    LoginRequest, LoginResponse,
    RefreshTokenRequest,
    RegisterRequest, RegisterResponse,
    ResendVerificationRequest, ResendVerificationResponse,
    TokenResponse,
    UserOut,
    VerifyOTPRequest, VerifyEmailResponse,
)
from app.services.email_service import send_verification_email
from app.services.sms_service import send_verification_sms

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)


def _dispatch_otp(
    background_tasks: BackgroundTasks,
    user: User,
    otp: str,
) -> None:
    """Send OTP via the user's chosen method (email or sms)."""
    if user.otp_method == "sms" and user.phone_number:
        background_tasks.add_task(
            send_verification_sms,
            user.phone_number,
            user.full_name,
            otp,
        )
    else:
        background_tasks.add_task(
            send_verification_email,
            user.email,
            user.full_name,
            otp,
        )


# ── REGISTER ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Validate: SMS method requires phone number
    if payload.otp_method == "sms" and not payload.phone_number:
        raise HTTPException(
            status_code=400,
            detail="A phone number is required when using SMS verification.",
        )

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists.",
        )

    otp = _generate_otp()

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="customer",
        phone_number=payload.phone_number,
        otp_method=payload.otp_method,
        email_verified=False,
        verification_code=otp,
        verification_code_expires=_otp_expiry(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _dispatch_otp(background_tasks, user, otp)

    method_label = "phone number" if payload.otp_method == "sms" else "email"
    return RegisterResponse(
        message=f"Verification code sent to your {method_label}.",
        email=user.email,
        otp_method=user.otp_method,
    )


# ── VERIFY OTP (works for both email and SMS) ─────────────────────────────────

@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    if user.email_verified:
        raise HTTPException(status_code=400, detail="Account is already verified.")

    if not user.verification_code or not user.verification_code_expires:
        raise HTTPException(
            status_code=400,
            detail="No verification code found. Request a new one.",
        )

    now = datetime.now(timezone.utc)
    expires = user.verification_code_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new one.",
        )

    if user.verification_code != payload.code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verified_at = datetime.now(timezone.utc)
    db.commit()

    return VerifyEmailResponse(message="Account verified successfully. You can now log in.")


# ── RESEND OTP ────────────────────────────────────────────────────────────────

@router.post("/resend-verification", response_model=ResendVerificationResponse)
def resend_verification(
    payload: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    if user.email_verified:
        raise HTTPException(status_code=400, detail="Account is already verified.")

    # Rate limit
    if user.verification_code_expires:
        expires = user.verification_code_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        cooldown_end = (
            expires
            - timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
            + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        )
        if datetime.now(timezone.utc) < cooldown_end:
            raise HTTPException(
                status_code=429,
                detail="Please wait 60 seconds before requesting a new code.",
            )

    otp = _generate_otp()
    user.verification_code = otp
    user.verification_code_expires = _otp_expiry()
    db.commit()

    _dispatch_otp(background_tasks, user, otp)

    method_label = "phone number" if user.otp_method == "sms" else "email"
    return ResendVerificationResponse(
        message=f"Verification code sent again to your {method_label}."
    )


# ── LOGIN ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your account before logging in.",
        )

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role, "email": user.email}
    )
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


# ── REFRESH TOKEN ─────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        token_payload = decode_token(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=401, detail="Invalid or expired refresh token."
        ) from exc

    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token.") from exc

    user = db.query(User).filter(User.id == user_id_int).first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists.")

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role, "email": user.email}
    )
    return TokenResponse(access_token=access_token)