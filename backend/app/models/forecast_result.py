from sqlalchemy import CheckConstraint, Column, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class ForecastResult(Base):
    __tablename__ = "forecast_results"
    __table_args__ = (
        UniqueConstraint("branch_id", "forecast_date", "model_registry_id", name="uq_forecast_branch_date_model"),
        CheckConstraint("predicted_value >= 0", name="ck_forecast_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    model_registry_id = Column(Integer, ForeignKey("model_registry.id"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False, index=True)
    predicted_value = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    demand_level = Column(String(20), nullable=False)
    data_quality = Column(String(30), nullable=False)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)

    branch = relationship("Branch")
    model_registry = relationship("ModelRegistry", back_populates="forecasts")
