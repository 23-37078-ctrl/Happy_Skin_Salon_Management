import string
import secrets
from datetime import datetime, timedelta, timezone
import httpx
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.schemas.user import SocialLoginRequest, SocialPhoneRequest, SocialPhoneVerifyRequest


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
    RegisterStartRequest, RegisterCompleteRequest,
    ResendVerificationRequest, ResendVerificationResponse,
    TokenResponse,
    UserOut,
    VerifyOTPRequest, VerifyEmailResponse,
)
from app.services.email_service import send_password_reset_email, send_verification_email
from app.services.sms_service import send_verification_sms

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _check_otp_attempts(user: User) -> None:
    if user.verification_attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new code after the resend cooldown.")


def _record_bad_otp(user: User, db: Session) -> None:
    user.verification_attempts += 1
    db.commit()


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

@router.post("/register/start", status_code=status.HTTP_201_CREATED)
def start_registration(
    payload: RegisterStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    pending_signup = bool(
        user
        and user.password_hash is None
        and user.oauth_provider is None
        and user.otp_method == "sms"
        and not user.email_verified
    )
    is_new_signup = user is None
    resend_window_expired = bool(user and user.verification_code_started_at and datetime.now(timezone.utc) >= (_as_utc(user.verification_code_started_at) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)))
    if user and not pending_signup:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if user and user.verification_code_expires:
        cooldown_end = (
            _as_utc(user.verification_code_expires)
            - timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
            + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        )
        if datetime.now(timezone.utc) < cooldown_end:
            raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting another code.")

    if resend_window_expired:
        user.verification_attempts = 0
    code = _generate_otp()
    if not user:
        user = User(
            full_name=payload.full_name,
            email=payload.email,
            password_hash=None,
            role="customer",
            phone_number=payload.phone_number,
            otp_method="sms",
            email_verified=False,
            phone_verified=False,
        )
        db.add(user)
    else:
        user.full_name = payload.full_name
        user.phone_number = payload.phone_number
        user.otp_method = "sms"
        user.email_verified = False
        user.phone_verified = False

    user.verification_code = code
    if is_new_signup or resend_window_expired or user.verification_code_started_at is None:
        user.verification_code_started_at = datetime.now(timezone.utc)
    user.verification_code_expires = _otp_expiry()
    db.commit()
    db.refresh(user)
    _dispatch_otp(background_tasks, user, code)
    return {"message": "Verification code sent to your phone number."}


@router.post("/register/verify-phone")
def verify_registration_phone(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.password_hash is not None:
        raise HTTPException(status_code=400, detail="No pending signup was found for this email.")
    if not user.verification_code or not user.verification_code_expires:
        raise HTTPException(status_code=400, detail="Request a new verification code first.")
    if datetime.now(timezone.utc) > _as_utc(user.verification_code_expires):
        raise HTTPException(status_code=400, detail="Verification code expired. Request a new one.")
    _check_otp_attempts(user)
    if user.verification_code != payload.code:
        _record_bad_otp(user, db)
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.phone_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verification_attempts = 0
    user.verification_code_started_at = None
    db.commit()
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "purpose": "signup_completion",
    })
    return {"verification_token": token, "message": "Phone number verified."}

@router.post("/register/complete")
def complete_registration(payload: RegisterCompleteRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.verification_token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Phone verification expired. Please verify your number again.") from exc
    if claims.get("purpose") != "signup_completion" or not claims.get("sub"):
        raise HTTPException(status_code=400, detail="Invalid signup verification.")
    try:
        user_id = int(claims["sub"])
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid signup verification.") from exc
    user = db.query(User).filter(User.id == user_id).first()
    if (
        not user
        or user.email != claims.get("email")
        or not user.phone_verified
        or user.password_hash is not None
    ):
        raise HTTPException(status_code=400, detail="This signup verification is no longer valid.")

    user.password_hash = hash_password(payload.password)
    user.email_verified = True
    user.verified_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Account created successfully. You can now sign in."}


@router.post("/register", status_code=status.HTTP_410_GONE)
def legacy_register():
    raise HTTPException(status_code=410, detail="Use /auth/register/start, /auth/register/verify-phone, and /auth/register/complete.")


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

    _check_otp_attempts(user)
    if user.verification_code != payload.code:
        _record_bad_otp(user, db)
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.email_verified = True
    if user.otp_method == "sms":
        user.phone_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verification_attempts = 0
    user.verification_code_started_at = None
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

    resend_window_expired = bool(user.verification_code_started_at and datetime.now(timezone.utc) >= (_as_utc(user.verification_code_started_at) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)))
    if resend_window_expired:
        user.verification_attempts = 0
        user.verification_code_started_at = datetime.now(timezone.utc)
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

    reset_window_expired = bool(user.password_reset_expires and datetime.now(timezone.utc) >= (_as_utc(user.password_reset_expires) - timedelta(minutes=settings.OTP_EXPIRE_MINUTES) + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)))
    if user.password_reset_attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS and not reset_window_expired:
        return VerifyEmailResponse(message=message)
    if reset_window_expired:
        user.password_reset_attempts = 0
    code = _generate_otp()
    user.password_reset_code = code
    user.password_reset_expires = _otp_expiry()
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

    if user.password_reset_attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect reset codes. Request a new code after the resend cooldown.")
    if user.password_reset_code != payload.code:
        user.password_reset_attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code.")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_code = None
    user.password_reset_expires = None
    user.password_reset_attempts = 0
    user.verification_attempts = 0
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

def _social_identity(provider: str, token: str) -> tuple[str, str, str, str | None]:
    if provider == "google":
        try:
            info = id_token.verify_oauth2_token(
                token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
            )
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid Google token.") from exc
        provider_id = info.get("sub")
        email = info.get("email")
        if not provider_id or not email:
            raise HTTPException(status_code=400, detail="Google account details are incomplete.")
        return provider_id, email.lower(), info.get("name") or email.split("@")[0], email

    with httpx.Client(timeout=10) as client:
        try:
            resp = client.get(
                "https://graph.facebook.com/me",
                params={"fields": "id,name,email", "access_token": token},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Could not verify Facebook sign-in.") from exc
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Facebook token.")
    info = resp.json()
    provider_id = info.get("id")
    if not provider_id:
        raise HTTPException(status_code=401, detail="Invalid Facebook account details.")
    email = info.get("email")
    account_email = email.lower() if email else f"facebook-{provider_id}@social.happyskin.invalid"
    return provider_id, account_email, info.get("name") or "Facebook customer", email


def _get_or_create_social_user(provider: str, identity: tuple[str, str, str, str | None], db: Session) -> User:
    provider_id, account_email, full_name, provider_email = identity
    user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_id == provider_id,
    ).first()
    linked_by_email = False
    if not user:
        user = db.query(User).filter(User.email == account_email).first() if provider_email else None
        linked_by_email = user is not None
    if not user:
        user = User(
            full_name=full_name,
            email=account_email,
            password_hash=None,
            role="customer",
            oauth_provider=provider,
            oauth_id=provider_id,
            email_verified=True,
            verified_at=datetime.now(timezone.utc),
        )
        db.add(user)
    else:
        if user.oauth_provider and (user.oauth_provider != provider or user.oauth_id != provider_id):
            raise HTTPException(status_code=409, detail="This email is linked to another social account.")
        if linked_by_email and user.password_hash:
            raise HTTPException(
                status_code=409,
                detail="An account already uses this email. Sign in with email and password, then connect social sign-in.",
            )
        user.oauth_provider = provider
        user.oauth_id = provider_id
        if not user.email_verified:
            user.email_verified = True
            user.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


@router.post("/google")
def google_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    user = _get_or_create_social_user("google", _social_identity("google", payload.token), db)
    if not user.phone_verified:
        return {"requires_phone": True, "provider": "google"}
    return _issue_login_response(user)


# ── FACEBOOK LOGIN ────────────────────────────────────────────────────────

@router.post("/facebook")
def facebook_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    user = _get_or_create_social_user("facebook", _social_identity("facebook", payload.token), db)
    if not user.phone_verified:
        return {"requires_phone": True, "provider": "facebook"}
    return _issue_login_response(user)


@router.post("/social/phone/request")
def request_social_phone_otp(
    payload: SocialPhoneRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    identity = _social_identity(payload.provider, payload.token)
    user = _get_or_create_social_user(payload.provider, identity, db)
    if user.phone_verified and user.phone_number == payload.phone_number:
        return {"message": "This phone number is already verified."}
    if user.phone_verified and user.phone_number != payload.phone_number:
        raise HTTPException(status_code=409, detail="A different phone number is already verified for this account.")

    if user.verification_code_expires:
        cooldown_end = (
            _as_utc(user.verification_code_expires)
            - timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
            + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        )
        if datetime.now(timezone.utc) < cooldown_end:
            raise HTTPException(status_code=429, detail="Please wait before requesting another code.")

    resend_window_expired = bool(user.verification_code_started_at and datetime.now(timezone.utc) >= (_as_utc(user.verification_code_started_at) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)))
    if resend_window_expired:
        user.verification_attempts = 0
        user.verification_code_started_at = datetime.now(timezone.utc)
    if user.verification_code_started_at and datetime.now(timezone.utc) >= (_as_utc(user.verification_code_started_at) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)):
        user.verification_attempts = 0
        user.verification_code_started_at = datetime.now(timezone.utc)
    code = _generate_otp()
    user.phone_number = payload.phone_number
    user.otp_method = "sms"
    user.phone_verified = False
    user.verification_code = code
    user.verification_code_expires = _otp_expiry()
    user.verification_code_started_at = user.verification_code_started_at or datetime.now(timezone.utc)
    db.commit()
    background_tasks.add_task(send_verification_sms, user.phone_number, user.full_name, code)
    return {"message": "Verification code sent to your phone number."}


@router.post("/social/phone/verify", response_model=LoginResponse)
def verify_social_phone(payload: SocialPhoneVerifyRequest, db: Session = Depends(get_db)):
    identity = _social_identity(payload.provider, payload.token)
    user = _get_or_create_social_user(payload.provider, identity, db)
    if user.phone_number != payload.phone_number:
        raise HTTPException(status_code=400, detail="Request a new code for this phone number.")
    if not user.verification_code or not user.verification_code_expires:
        raise HTTPException(status_code=400, detail="Request a verification code first.")
    if datetime.now(timezone.utc) > _as_utc(user.verification_code_expires):
        raise HTTPException(status_code=400, detail="Verification code expired. Request a new one.")
    _check_otp_attempts(user)
    if user.verification_code != payload.code:
        _record_bad_otp(user, db)
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    user.phone_verified = True
    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verification_attempts = 0
    user.verification_code_started_at = None
    user.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return _issue_login_response(user)
