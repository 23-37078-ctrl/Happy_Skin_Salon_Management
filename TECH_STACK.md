# Happy Skin Salon Management — Technology Stack

**Document date:** October 16, 2026  
**Purpose:** Project handoff and team reference  
**Scope:** Technology and architecture identified from the repository files. This document does not include credentials or `.env` values.

## At a glance

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | React 19, JavaScript ES modules | Browser user interface |
| Frontend tooling | Vite 8, React plugin, ESLint 10 | Development server, production build, linting |
| UI and charts | Tailwind CSS 4, Framer Motion, React Icons, Recharts | Styling, animation, icons, dashboards |
| Client routing and API | React Router 7, Axios | Navigation and HTTP requests |
| Mobile packaging | Capacitor 8 for Android and iOS | Package the frontend for mobile platforms |
| Backend API | Python 3, FastAPI | REST API and OpenAPI documentation |
| ASGI server | Uvicorn | Serves the FastAPI application |
| Validation and configuration | Pydantic 2, pydantic-settings | Request/data validation and environment configuration |
| ORM and migrations | SQLAlchemy 2, Alembic | Database access and schema migrations |
| Database | PostgreSQL; project docs describe a Supabase-hosted PostgreSQL database | Persistent application data |
| Forecasting and analytics | pandas, NumPy, scikit-learn, joblib | Data preparation, model training/evaluation, artifact handling |
| Authentication and security | JWT via python-jose; Argon2/bcrypt password hashing; Google token verification | Authentication and credential protection |
| Notifications/integrations | SMTP email, iProgSMS, Google OAuth, Facebook access-token validation | OTP and social sign-in integrations |
| Testing | pytest; Vitest and Testing Library | Backend and frontend tests |

## Frontend

The frontend is a React single-page application built and served with Vite. Axios communicates with the backend API, and React Router handles client-side routes. Recharts powers charting; Tailwind CSS, Framer Motion, and React Icons support presentation and interaction. Capacitor packages the application for Android and iOS.

The frontend is configured to use the versioned API base URL, typically `http://localhost:8000/api/v1` for local development. Vite client variables use the `VITE_` prefix and are bundled for browser use, so secrets must never be placed in them.

## Backend and API

The backend is a Python FastAPI application. The application is initialized in `backend/main.py`; its versioned API is mounted under `/api/v1`. Uvicorn runs the ASGI application. FastAPI exposes interactive API documentation at `/docs` and ReDoc at `/redoc` during development.

Pydantic validates API data and reads typed settings. SQLAlchemy handles database access, while Alembic manages schema migrations. The database connection is configured through `DATABASE_URL`; this document intentionally does not reproduce its value.

### Main API areas

The mounted API includes health, public catalog, authentication, customer, transactions, manager, owner, and forecasting routes. The backend documentation describes endpoints for services and branches, bookings, transactions, reports, inventory, feedback, notifications, and forecasts.

## Database

The application uses PostgreSQL through the PostgreSQL psycopg2 driver. Project documentation refers to Supabase PostgreSQL for the live database. SQLAlchemy models and Alembic migrations define and evolve the schema. Core entities include users, roles, branches, services, bookings, booking service items, transactions, inventory, feedback, forecast results, and model registry records.

Transactions have a unique constraint on `booking_id`, so the schema permits at most one transaction per booking. Bookings reference customers, branches, services, and optionally service providers. Check the current models and migrations before preparing imports or synthetic data; do not infer production schema solely from this summary.

## Machine learning and forecasting

The implemented forecasting workflow currently predicts **daily completed appointment demand per branch**, not sales transaction revenue. Its target is the count of completed appointments on each branch business date. It derives calendar features and lag/rolling features from historical daily demand, with history shifted to avoid target leakage.

The training code compares a seven-day seasonal-naive baseline with Ridge regression, Random Forest, and Histogram Gradient Boosting using chronological validation. It reports MAE, RMSE, and WAPE, and registers the selected model. The API provides forecasts and recommendations to authorized owners and assigned managers. A readiness gate prevents training when the history is too small; forecast reads can use a clearly identified moving-average fallback.

**Implication for sales prediction:** The current documented/model implementation is an appointment-demand forecaster. A sales-revenue model would need a separately defined target (for example, daily transaction revenue) and compatible revenue features and training pipeline. Do not treat the current appointment-count forecast as a sales forecast.

## Authentication and integrations

- Access and refresh tokens use JWT. The documented defaults are a 30-minute access-token lifetime and a 7-day refresh-token lifetime; actual settings can differ by environment.
- Passwords use Argon2/bcrypt-related packages (confirm the active hasher in the security implementation when documenting a deployment).
- OTP delivery is supported through configured email (SMTP) or SMS (iProgSMS).
- Google sign-in verifies Google identity tokens. Facebook sign-in currently validates a client-provided access token through the Graph API, as described by backend documentation.
- CORS origins are configuration-dependent and should be restricted to deployed frontend origins in production.

## Repository locations

| Area | Location |
| --- | --- |
| Backend application | `backend/app/` and `backend/main.py` |
| Backend dependencies | `backend/requirements.txt` |
| Database models | `backend/app/models/` |
| Database migrations | `backend/migrations/` |
| Forecasting implementation | `backend/app/ml/` and `backend/app/services/forecast_service.py` |
| Frontend source | `frontend/` |
| Frontend dependencies and scripts | `frontend/package.json` |
| Backend project notes | `BACKEND_DOCUMENTATION.md` and `backend/AI_FORECASTING.md` |

## Common development commands

Backend (from `backend/`, after activating the project virtual environment):

```powershell
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
alembic upgrade head
```

Frontend (from `frontend/`):

```powershell
npm install
npm run dev
npm run lint
npm test
npm run build
```

Mobile scripts include `npm run android:open`, `npm run android:run`, `npm run ios:open`, and `npm run mobile:doctor` (platform tooling is also required).

## Configuration and secret handling

Runtime configuration is loaded from environment settings, with local backend values commonly kept in `backend/.env` and frontend values in `frontend/.env`. Keep real `.env` files and credentials out of version control and out of shared documents. Use redacted placeholders in examples, separate credentials by environment, and rotate any secret that has been exposed. Never place private credentials in frontend `VITE_*` variables.

## Verification notes and limits

This summary was prepared by reviewing the repository's dependency manifests, backend documentation, API entry point, selected SQLAlchemy models, and forecasting implementation. Dependency versions reflect the checked-in manifests and may change as the project evolves. The current active database, deployed configuration, and installed runtime versions were not queried. Confirm those before using this document as a production deployment inventory.
