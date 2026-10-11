from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


# ── Request Schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone_number: str
    otp_method: str = "sms"

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name is required.")
        return v.strip()

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.strip().replace(" ", "").replace("-", "")
        if not (
            (cleaned.startswith("09") and len(cleaned) == 11) or
            (cleaned.startswith("+639") and len(cleaned) == 13) or
            (cleaned.startswith("639") and len(cleaned) == 12)
        ):
            raise ValueError("Enter a valid PH mobile number (e.g. 09171234567).")
        return cleaned

    @field_validator("otp_method")
    @classmethod
    def sms_only(cls, value: str) -> str:
        if value != "sms":
            raise ValueError("Signup verification is available by SMS only.")
        return value


class RegisterStartRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Full name is required.")
        return value.strip()

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return RegisterRequest.validate_phone(value)


class RegisterCompleteRequest(BaseModel):
    verification_token: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    
class SocialLoginRequest(BaseModel):
    token: str


class SocialPhoneRequest(BaseModel):
    provider: str
    token: str
    phone_number: str

    @field_validator("provider")
    @classmethod
    def supported_provider(cls, value: str) -> str:
        if value not in {"google", "facebook"}:
            raise ValueError("Unsupported sign-in provider.")
        return value

    @field_validator("phone_number")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        return RegisterRequest.validate_phone(value)


class SocialPhoneVerifyRequest(SocialPhoneRequest):
    code: str

    @field_validator("code")
    @classmethod
    def six_digit_code(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 6:
            raise ValueError("Verification code must be 6 digits.")
        return value

class VerifyOTPRequest(BaseModel):
    """Works for both email and SMS verification."""
    email: EmailStr
    code: str

    @field_validator("code")
    @classmethod
    def code_is_six_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Verification code must be 6 digits.")
        return v


# Keep old name as alias so existing imports don't break
VerifyEmailRequest = VerifyOTPRequest


class ResendVerificationRequest(BaseModel):
    email: EmailStr


# ── Response Schemas ──────────────────────────────────────────────────────────

class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

    @field_validator("code")
    @classmethod
    def code_is_six_digits(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 6:
            raise ValueError("Reset code must be 6 digits.")
        return value

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return value


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    branch_id: Optional[int] = None
    email_verified: bool
    phone_verified: bool = False
    phone_number: Optional[str] = None
    otp_method: str = "email"
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    full_name: str
    phone_number: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def profile_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name is required.")
        return v.strip()

    @field_validator("phone_number")
    @classmethod
    def profile_phone_valid(cls, v: Optional[str]) -> Optional[str]:
        return RegisterRequest.validate_phone(v)


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class RegisterResponse(BaseModel):
    message: str
    email: str
    otp_method: str          # tells frontend which method was used


class VerifyEmailResponse(BaseModel):
    message: str


class ResendVerificationResponse(BaseModel):
    message: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
