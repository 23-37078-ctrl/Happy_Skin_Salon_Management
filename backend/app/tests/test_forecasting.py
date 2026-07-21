from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.ml.preprocessing import add_time_series_features, assess_readiness, extract_daily_completed_demand
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.service import Service
from app.models.user import User
from app.services.forecast_service import InsufficientForecastData, build_branch_forecast, train_forecast_model
from main import app


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def seed_branch(db):
    branch = Branch(name="Test Branch", address="Test Address", is_active=True)
    service = Service(name="Facial", price=500, duration_minutes=60, is_active=True)
    db.add_all([branch, service])
    db.commit()
    return branch, service


def test_preprocessing_filters_non_completed_and_fills_missing_days(db):
    branch, service = seed_branch(db)
    db.add_all([
        Booking(customer_id=1, branch_id=branch.id, service_id=service.id, appointment_date=datetime(2026, 1, 1, 2, tzinfo=timezone.utc), status="completed"),
        Booking(customer_id=2, branch_id=branch.id, service_id=service.id, appointment_date=datetime(2026, 1, 2, 2, tzinfo=timezone.utc), status="cancelled"),
    ])
    db.commit()

    frame = extract_daily_completed_demand(db, branch_id=branch.id, through_date=date(2026, 1, 3))

    assert frame["demand"].tolist() == [1, 0, 0]
    assert frame["date"].tolist() == [date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3)]


def test_lag_features_do_not_include_current_target():
    import pandas as pd

    frame = pd.DataFrame({
        "branch_id": [1] * 30,
        "date": pd.date_range("2026-01-01", periods=30).date,
        "demand": list(range(30)),
    })
    featured = add_time_series_features(frame)

    assert featured.iloc[29]["lag_1"] == 28
    assert featured.iloc[29]["lag_7"] == 22
    assert featured.iloc[29]["rolling_mean_7"] == pytest.approx(sum(range(22, 29)) / 7)


def test_current_small_dataset_uses_non_negative_transparent_fallback(db):
    branch, service = seed_branch(db)
    db.add(Booking(customer_id=1, branch_id=branch.id, service_id=service.id, appointment_date=datetime.now(timezone.utc), status="completed"))
    db.commit()

    result = build_branch_forecast(db, branch.id)

    assert result["data_quality"] == "insufficient"
    assert "fallback" in result["model"]
    assert len(result["predictions"]) == 7
    assert all(point["predicted_demand"] >= 0 for point in result["predictions"])
    assert all("Manual staffing" not in point["recommendation"] or point["demand_level"] == "high" for point in result["predictions"])


def test_training_refuses_insufficient_history(db):
    seed_branch(db)
    readiness = assess_readiness(extract_daily_completed_demand(db))
    assert readiness.sufficient is False

    with pytest.raises(InsufficientForecastData):
        train_forecast_model(db)


def _api_client(db, user: User, raise_server_exceptions: bool = True):
    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def test_manager_can_only_access_assigned_branch(db):
    branch, _ = seed_branch(db)
    manager = User(id=10, full_name="Manager", email="manager@test.local", role="manager", branch_id=branch.id, email_verified=True)
    try:
        with _api_client(db, manager) as client:
            allowed = client.get(f"/api/v1/forecast/branches/{branch.id}")
            forbidden = client.get("/api/v1/forecast/branches/999")
        assert allowed.status_code == 200
        assert forbidden.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_owner_receives_not_found_for_unknown_branch_and_no_accuracy(db):
    owner = User(id=11, full_name="Owner", email="owner@test.local", role="owner", email_verified=True)
    try:
        with _api_client(db, owner) as client:
            missing_branch = client.get("/api/v1/forecast/branches/999")
            missing_model = client.get("/api/v1/forecast/accuracy")
        assert missing_branch.status_code == 404
        assert missing_model.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_manager_cannot_trigger_training(db):
    manager = User(id=12, full_name="Manager", email="manager2@test.local", role="manager", branch_id=1, email_verified=True)
    try:
        with _api_client(db, manager) as client:
            response = client.post("/api/v1/forecast/train")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
