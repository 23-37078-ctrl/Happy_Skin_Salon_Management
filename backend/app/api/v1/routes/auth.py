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
    VerifyEmailRequest, VerifyEmailResponse,
)
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)


# ── REGISTER ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    otp = _generate_otp()

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="customer",
        email_verified=False,
        verification_code=otp,
        verification_code_expires=_otp_expiry(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    background_tasks.add_task(send_verification_email, user.email, user.full_name, otp)

    return RegisterResponse(
        message="Verification code sent to your email.",
        email=user.email,
    )


# ── VERIFY EMAIL ──────────────────────────────────────────────────────────────

@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified.")

    if not user.verification_code or not user.verification_code_expires:
        raise HTTPException(status_code=400, detail="No verification code found. Request a new one.")

    now = datetime.now(timezone.utc)
    expires = user.verification_code_expires
    # Make expires timezone-aware if stored as naive
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if user.verification_code != payload.code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verified_at = datetime.now(timezone.utc)
    db.commit()

    return VerifyEmailResponse(message="Email verified successfully.")


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
        raise HTTPException(status_code=400, detail="Email is already verified.")

    # Rate limit: check if last OTP was sent within cooldown window
    if user.verification_code_expires:
        expires = user.verification_code_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        cooldown_end = expires - timedelta(minutes=settings.OTP_EXPIRE_MINUTES) + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        if datetime.now(timezone.utc) < cooldown_end:
            raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting a new code.")

    otp = _generate_otp()
    user.verification_code = otp
    user.verification_code_expires = _otp_expiry()
    db.commit()

    background_tasks.add_task(send_verification_email, user.email, user.full_name, otp)

    return ResendVerificationResponse(message="Verification code sent again.")


# ── LOGIN ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    access_token  = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        token_payload = decode_token(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.") from exc

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
