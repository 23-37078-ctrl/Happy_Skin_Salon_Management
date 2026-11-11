from datetime import date, datetime

from pydantic import BaseModel, Field


class HistoricalDemandPoint(BaseModel):
    date: date
    actual_demand: int = Field(ge=0)


class ServiceCapacityPoint(BaseModel):
    service_id: int
    service_name: str
    expected_bookings: float = Field(ge=0)
    suggested_slots: int = Field(ge=0)
    duration_minutes: int = Field(ge=0)


class ForecastPoint(BaseModel):
    date: date
    predicted_demand: float = Field(ge=0)
    lower_bound: float | None = Field(default=None, ge=0)
    upper_bound: float | None = Field(default=None, ge=0)
    demand_level: str
    recommendation: str
    active_staff_count: int = Field(default=0, ge=0)
    recommended_staff_count: int = Field(default=0, ge=0)
    staffing_gap: int = Field(default=0, ge=0)
    service_capacity: list[ServiceCapacityPoint] = Field(default_factory=list)


class ForecastReadiness(BaseModel):
    status: str
    history_days: int = Field(ge=0)
    completed_appointments: int = Field(ge=0)
    nonzero_days: int = Field(ge=0)
    reasons: list[str]


class BranchForecastResponse(BaseModel):
    branch_id: int
    branch_name: str
    forecast_period: str
    horizon_days: int
    model: str
    model_version: str | None = None
    generated_at: datetime
    data_quality: str
    data_source: str = "operational"
    limitation: str | None = None
    readiness: ForecastReadiness
    historical: list[HistoricalDemandPoint]
    predictions: list[ForecastPoint]


class ModelAccuracyResponse(BaseModel):
    model: str
    version: str
    trained_at: datetime
    training_period: str
    training_rows: int
    metrics: dict[str, float | None]


class TrainingResponse(BaseModel):
    message: str
    model: str
    version: str
    metrics: dict[str, float | None]
    training_rows: int
