from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, field_validator


# ── Request Schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone_number: Optional[str] = None          # Required if otp_method is "sms"
    otp_method: Literal["email", "sms"] = "email"

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
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip().replace(" ", "").replace("-", "")
        # Accept 09xxxxxxxxx or +639xxxxxxxxx
        if not (
            (cleaned.startswith("09") and len(cleaned) == 11) or
            (cleaned.startswith("+639") and len(cleaned) == 13)
        ):
            raise ValueError("Enter a valid PH mobile number (e.g. 09171234567).")
        return cleaned


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    branch_id: Optional[int] = None
    email_verified: bool
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
