from pathlib import Path
from pydantic import model_validator

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost/happy_skin"
    DATABASE_CONNECT_TIMEOUT_SECONDS: int = 10
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_RECYCLE_SECONDS: int = 1800

    # JWT
    SECRET_KEY: str = "change-this-to-a-long-random-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_ATTEMPT_WINDOW_MINUTES: int = 15
    PASSWORD_RESET_MAX_ATTEMPTS: int = 5

    # SMTP
    SMTP_HOST: str = "sandbox.smtp.mailtrap.io"
    SMTP_PORT: int = 2525
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""      
    EMAIL_FROM: str = ""
    
    # SMS (iProgSMS)
    IPROG_API_TOKEN: str = ""

    # OTP
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # OAuth
    GOOGLE_CLIENT_ID: str = "1052189554415-0tr5qpn1bhr3n7ldojhuddf9u93ddhnd.apps.googleusercontent.com"

    # Runtime
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = ""

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.ENVIRONMENT.lower() == "production":
            if len(self.SECRET_KEY) < 32 or self.SECRET_KEY == "change-this-to-a-long-random-secret":
                raise ValueError("Production requires a unique SECRET_KEY of at least 32 characters.")
            if not self.DATABASE_URL or "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
                raise ValueError("Production requires a configured remote DATABASE_URL.")
            if not self.CORS_ORIGINS.strip():
                raise ValueError("Production requires CORS_ORIGINS with the deployed frontend origins.")
        return self

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
