# Happy Skin Salon Management — Backend Documentation

Last updated: July 20, 2026

## Overview

The backend is a FastAPI application using SQLAlchemy, Alembic migrations, PostgreSQL (Supabase), JWT authentication, Mailtrap SMTP, iProgSMS, and Google/Facebook social login.

- API root: `http://localhost:8000`
- API prefix: `/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Environment configuration

Create `backend/.env`. Never commit this file or share real credentials in documentation or chat.

```dotenv
# Database
DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>:5432/<database>

# JWT
SECRET_KEY=<long-random-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email (Mailtrap)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USERNAME=<mailtrap-username>
SMTP_PASSWORD=<mailtrap-password>
EMAIL_FROM=noreply@happyskinsalon.com

# SMS (iProgSMS)
IPROG_API_TOKEN=<iprog-api-token>

# OTP
OTP_EXPIRE_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60

# Google OAuth token verification
GOOGLE_CLIENT_ID=<google-client-id>
```

Frontend-only variables belong in `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
VITE_GOOGLE_CLIENT_ID=<google-client-id>
VITE_FACEBOOK_APP_ID=<facebook-app-id>
```

Notes:

- `VITE_API_URL` must include `/api/v1` because the frontend appends paths such as `/auth/login` and `/customer/dashboard` directly.
- `FACEBOOK_APP_SECRET` must never be placed in a `VITE_*` variable because Vite exposes those values to the browser.
- The current Facebook backend flow validates a user access token through the Graph API and does not read `FACEBOOK_APP_ID` or `FACEBOOK_APP_SECRET` from backend settings.
- Replace the sample JWT secret with a cryptographically random value before running the application.

Generate a suitable JWT secret with Python:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Local setup

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary pydantic-settings python-jose passlib bcrypt email-validator requests httpx google-auth
```

The repository's `backend/requirements.txt` is currently empty. Until it is populated, the explicit package installation above is required for a clean environment.

## Database migrations

The application reads `DATABASE_URL` from `backend/.env`, but the current Alembic configuration still contains a local MySQL URL. Before applying migrations to Supabase, update Alembic to consume the application database URL; otherwise `alembic upgrade head` targets the MySQL URL in `backend/alembic.ini`.

After Alembic is configured for the environment URL:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
python seed_services.py
```

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/docs` to inspect and test the live OpenAPI contract.

## API groups

All routes below start with `/api/v1`.

| Area | Prefix | Main operations |
| --- | --- | --- |
| Public | `/public` | List services and branches |
| Authentication | `/auth` | Register, verify/resend OTP, login, refresh token, Google login, Facebook login |
| Customer | `/customer` | Dashboard, branches, services, appointments, feedback, notifications |
| Staff bookings | `/staff/bookings` | List/get bookings and update booking status |
| Staff transactions | `/staff/transactions` | Create and list transactions |
| Manager | `/manager` | Dashboard, bookings, transactions, inventory, reports, forecasting, feedback, profile |
| Owner | `/owner` | Dashboard, branches, users, bookings, transactions, reports, forecasting, workforce, audit logs |

Protected routes expect an access token:

```http
Authorization: Bearer <access-token>
```

## Authentication lifecycle

1. A customer registers through `POST /api/v1/auth/register`.
2. The backend sends an OTP through the selected email or SMS method.
3. The customer confirms it through `POST /api/v1/auth/verify-email`.
4. Login returns an access token, refresh token, and user object.
5. The access token expires after 30 minutes by default; the refresh token expires after 7 days.

## CORS

The backend currently allows local Vite origins on ports `5173` and `5174`, over HTTP and HTTPS. Add deployed frontend origins explicitly before production deployment.

## Security checklist

- Rotate any database password, SMTP password, SMS token, OAuth secret, or JWT secret that has been exposed.
- Keep `backend/.env` ignored by Git; commit only redacted examples.
- Use a unique, randomly generated `SECRET_KEY` in every environment.
- Do not expose backend secrets through `VITE_*` variables.
- Restrict Supabase database access and use separate development and production credentials.
- Replace sandbox email configuration with an approved production provider before launch.
- Configure production CORS origins explicitly and remove unnecessary localhost origins in production.

## Known configuration gaps

- `backend/requirements.txt` is empty.
- Alembic currently points to a local MySQL database instead of `DATABASE_URL`.
- The supplied `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are not declared in `backend/app/core/config.py`; the current Facebook login implementation only uses the client-supplied access token.
- Several route modules exist but are not mounted in `backend/app/api/v1/api.py`; only public, auth, customer, bookings, transactions, manager, and owner routers are currently active.
