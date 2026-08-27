import random
import string
from datetime import datetime, timedelta, timezone
import httpx
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.schemas.user import SocialLoginRequest


from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
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
from app.models.auth_event import AuthEvent
from app.schemas.user import (
    LoginRequest, LoginResponse,
    PasswordResetConfirmRequest, PasswordResetRequest,
    RefreshTokenRequest,
    RegisterRequest, RegisterResponse,
    ResendVerificationRequest, ResendVerificationResponse,
    TokenResponse,
    UserOut,
    VerifyOTPRequest, VerifyEmailResponse,
)
from app.services.email_service import send_password_reset_email, send_verification_email
from app.services.sms_service import send_verification_sms

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


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


def _record_auth_event(db: Session, request: Request, email: str, event_type: str, user: User | None = None) -> None:
    db.add(
        AuthEvent(
            user_id=user.id if user else None,
            email=email.lower(),
            event_type=event_type,
            ip_address=request.client.host if request.client else None,
            user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        )
    )


def _issue_login_response(user: User) -> LoginResponse:
    token_data = {"sub": str(user.id), "role": user.role, "email": user.email, "sv": user.session_version}
    return LoginResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token({"sub": str(user.id), "sv": user.session_version}),
        user=UserOut.model_validate(user),
    )


def _check_login_rate_limit(db: Session, email: str) -> None:
    window_start = datetime.utcnow() - timedelta(minutes=settings.LOGIN_ATTEMPT_WINDOW_MINUTES)
    failed_attempts = (
        db.query(AuthEvent)
        .filter(
            AuthEvent.email == email.lower(),
            AuthEvent.event_type == "login_failed",
            AuthEvent.created_at >= window_start,
        )
        .count()
    )
    if failed_attempts >= settings.LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many failed sign-in attempts. Please try again later.")


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


@router.post("/password-reset/request", response_model=VerifyEmailResponse)
def request_password_reset(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    message = "If an active account uses this email, a password reset code has been sent."
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.is_active or not user.email_verified or not user.password_hash:
        return VerifyEmailResponse(message=message)

    if user.password_reset_expires:
        cooldown_end = (
            _as_utc(user.password_reset_expires)
            - timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
            + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        )
        if datetime.now(timezone.utc) < cooldown_end:
            return VerifyEmailResponse(message=message)

    code = _generate_otp()
    user.password_reset_code = code
    user.password_reset_expires = _otp_expiry()
    user.password_reset_attempts = 0
    db.commit()
    background_tasks.add_task(send_password_reset_email, user.email, user.full_name, code)
    return VerifyEmailResponse(message=message)


@router.post("/password-reset/confirm", response_model=VerifyEmailResponse)
def confirm_password_reset(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.is_active or not user.password_reset_code or not user.password_reset_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code.")

    if datetime.now(timezone.utc) > _as_utc(user.password_reset_expires):
        user.password_reset_code = None
        user.password_reset_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code.")

    if user.password_reset_attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS or user.password_reset_code != payload.code:
        user.password_reset_attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code.")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_code = None
    user.password_reset_expires = None
    user.password_reset_attempts = 0
    user.session_version += 1
    user.updated_at = datetime.utcnow()
    db.commit()
    return VerifyEmailResponse(message="Password reset successfully. Please sign in with your new password.")


# ── LOGIN ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    _check_login_rate_limit(db, str(payload.email))
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        _record_auth_event(db, request, str(payload.email), "login_failed", user)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        _record_auth_event(db, request, user.email, "login_inactive", user)
        db.commit()
        raise HTTPException(status_code=403, detail="This account is inactive. Please contact an administrator.")

    if not user.email_verified:
        _record_auth_event(db, request, user.email, "login_unverified", user)
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Please verify your account before logging in.",
        )

    _record_auth_event(db, request, user.email, "login_success", user)
    db.commit()
    return _issue_login_response(user)


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
    if not user or not user.is_active or token_payload.get("sv", 0) != user.session_version:
        raise HTTPException(status_code=401, detail="User no longer exists.")

    access_token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email, "sv": user.session_version})
    return TokenResponse(access_token=access_token)

# ── GOOGLE LOGIN ──────────────────────────────────────────────────────────

@router.post("/google", response_model=LoginResponse)
def google_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    try:
        info = id_token.verify_oauth2_token(
            payload.token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token.")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            full_name=info.get("name", email.split("@")[0]),
            email=email,
            password_hash=None,
            role="customer",
            oauth_provider="google",
            oauth_id=info.get("sub"),
            email_verified=True,   # Google already verified this email
            verified_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.email_verified:
        # existing unverified local account signing in via Google — verify it
        user.email_verified = True
        user.verified_at = datetime.now(timezone.utc)
        db.commit()

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role, "email": user.email}
    )
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


# ── FACEBOOK LOGIN ────────────────────────────────────────────────────────

@router.post("/facebook", response_model=LoginResponse)
def facebook_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    with httpx.Client() as client:
        resp = client.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,name,email",
                "access_token": payload.token,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Facebook token.")

    data = resp.json()
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Your Facebook account has no email attached. Please use email login.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            full_name=data.get("name", email.split("@")[0]),
            email=email,
            password_hash=None,
            role="customer",
            oauth_provider="facebook",
            oauth_id=data.get("id"),
            email_verified=True,
            verified_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.email_verified:
        user.email_verified = True
        user.verified_at = datetime.now(timezone.utc)
        db.commit()

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role, "email": user.email}
    )
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )
