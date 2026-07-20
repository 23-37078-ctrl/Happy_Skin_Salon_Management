# Demand Forecasting and Operational Decision Support

## Purpose

The module predicts daily completed appointment demand for the next seven days. It is decision support only: owners and managers remain responsible for staffing and capacity decisions.

## Data flow

```text
Supabase PostgreSQL bookings
  -> SQLAlchemy aggregate extraction
  -> completed-only daily series in Asia/Manila
  -> data-quality/readiness gate
  -> shifted lag and rolling features
  -> chronological candidate evaluation
  -> versioned model artifact and model_registry
  -> seven-day forecast_results
  -> FastAPI
  -> React actual-versus-predicted dashboard
```

No customer names, emails, phone numbers, or other personal attributes enter the ML frame.

## Target and features

- Target: completed appointments per branch and business date.
- Horizon: seven days by default; API permits 1–14 days.
- Calendar features: weekday, month, ISO week, weekend.
- Historical features: lags 1/7/14/28, shifted rolling means 7/28, and shifted seven-day trend.
- All historical features are shifted by at least one day to prevent target leakage.

The current day is excluded because it is not a closed observation. Cancelled, pending, confirmed, and future appointments are not counted as completed demand.

## Readiness gate

Training requires all of the following:

- 56 calendar days of history;
- 30 completed appointments;
- demand on at least 14 distinct days;
- at least 28 feature-complete dates for chronological validation.

If these conditions are not met, `POST /api/v1/forecast/train` returns HTTP 409 with the observed counts and reasons. Forecast reads remain available through a clearly identified 28-day moving-average fallback. No accuracy is claimed for fallback output.

## Candidate selection

Training compares:

1. seven-day seasonal naive baseline;
2. Ridge regression;
3. Random Forest;
4. Histogram Gradient Boosting.

The comparison uses chronological rolling folds and reports MAE, RMSE, and WAPE. MAPE is intentionally omitted because daily demand may be zero. The lowest-MAE candidate is fitted to all eligible history and registered. Random seeds are fixed where applicable.

## Persistence

- `model_registry` stores version, algorithm, training range, metrics, feature configuration, artifact checksum, row count, and active status.
- `forecast_results` stores each branch/date prediction and its model version.
- Serialized estimator artifacts are written to `backend/ml/models/` only after successful validation.

The migration is `f4a8c2d1e901_add_forecasting_registry_and_results.py`.

## API

All paths are below `/api/v1` and require a bearer token.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/forecast/branches/{branch_id}` | Owner; assigned manager | Forecast, history, readiness, limitations |
| GET | `/forecast/branches/{branch_id}/recommendations` | Owner; assigned manager | Rule-based recommendations |
| GET | `/forecast/accuracy` | Owner, manager | Active validated model metrics |
| POST | `/forecast/train` | Owner only | Manual model training and activation |

Managers cannot request another branch. Staff and customers have no forecasting access.

## Recommendation rules

Prediction and recommendation are separate. Demand is categorized relative to recent branch demand. Because schedules, working hours, and staff qualifications are absent, recommendations never invent an exact staff count. High demand produces a manual staffing and service-capacity review recommendation.

## Operations

Install dependencies:

```powershell
cd backend
..\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Apply migrations:

```powershell
..\venv\Scripts\alembic.exe upgrade head
```

Run backend tests:

```powershell
..\venv\Scripts\python.exe -m pytest app\tests -q
```

Run frontend verification:

```powershell
cd ..\frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Training is manual through the owner dashboard or API. Normal GET requests never train a model.

## Current limitation

As of July 20, 2026, live Supabase data contains one completed appointment, two bookings, and one active branch. The API therefore returns `data_quality: insufficient`, uses the descriptive fallback, leaves uncertainty bounds empty, and refuses ML training. This is intentional and should remain until real operational history satisfies the readiness gate.

Future capacity work requires branch operating hours, staff shifts, staff-service qualifications, and explicit completion/no-show timestamps.
