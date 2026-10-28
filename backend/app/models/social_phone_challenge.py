from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.core.database import Base


class SocialPhoneChallenge(Base):
    __tablename__ = "social_phone_challenges"
    __table_args__ = (
        UniqueConstraint("provider", "provider_id", name="uq_social_phone_provider_identity"),
    )

    id = Column(Integer, primary_key=True)
    provider = Column(String(20), nullable=False)
    provider_id = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=False)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, nullable=False)
