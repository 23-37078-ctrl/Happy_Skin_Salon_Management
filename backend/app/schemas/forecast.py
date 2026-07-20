from datetime import date, datetime

from pydantic import BaseModel, Field


class HistoricalDemandPoint(BaseModel):
    date: date
    actual_demand: int = Field(ge=0)


class ForecastPoint(BaseModel):
    date: date
    predicted_demand: float = Field(ge=0)
    lower_bound: float | None = Field(default=None, ge=0)
    upper_bound: float | None = Field(default=None, ge=0)
    demand_level: str
    recommendation: str


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
