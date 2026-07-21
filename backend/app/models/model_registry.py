from sqlalchemy import Boolean, Column, Date, DateTime, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"
    __table_args__ = (UniqueConstraint("version", name="uq_model_registry_version"),)

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False)
    algorithm = Column(String(100), nullable=False)
    version = Column(String(80), nullable=False)
    training_start_date = Column(Date, nullable=False)
    training_end_date = Column(Date, nullable=False)
    trained_at = Column(DateTime, server_default=func.now(), nullable=False)
    metrics = Column(JSON, nullable=False)
    feature_config = Column(JSON, nullable=False)
    artifact_path = Column(String(500), nullable=True)
    artifact_checksum = Column(String(64), nullable=True)
    training_rows = Column(Integer, nullable=False)
    active = Column(Boolean, default=True, nullable=False, index=True)

    forecasts = relationship("ForecastResult", back_populates="model_registry")
