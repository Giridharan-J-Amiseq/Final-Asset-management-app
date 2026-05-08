# WorkSphere — Asset Management System

WorkSphere is an internal asset management application for tracking company assets, assigning/transferring assets to users, logging maintenance issues, and generating QR codes for physical asset tagging.

This repository contains:

- **Backend API**: FastAPI + PostgreSQL + SQLAlchemy ORM
- **Frontend UI**: React + Vite + Tailwind CSS

The backend can also serve the built React app under `/app` in production.

---

## Features

- Asset inventory: create, update, list, filter, retire
- Asset QR codes: generate PNG QR images for each asset
- Asset assignment and transfer workflows (audit-friendly transaction history)
- Maintenance workflow: log issue → mark “In Repair” → close issue → return to “Available”
- Dashboard: counts by status, warranty alerts, recent transactions, recent maintenance
- Role-based access: **Admin**, **Viewer**
- Authentication:
  - Local username/password (SHA-256 hashes) with JWT bearer tokens
  - Optional Microsoft Entra ID (Azure AD) OAuth login + Graph employee import

---

## Tech Stack

**Backend**

- FastAPI, Uvicorn
- PostgreSQL
- SQLAlchemy (ORM)
- JWT auth (`python-jose`)
- `.env` loading via `python-dotenv`
- QR code generation via `qrcode`

**Frontend**

- React (React Router)
- Vite
- Tailwind CSS

---

## Project Structure

Primary code lives under:

- `backend/` — FastAPI app
- `frontend-react/` — React app
- `database_schema_postgres.sql` — schema + seed users
- `PROJECT_DOCUMENTATION.md` — detailed internal documentation

Backend layers (high level):

- `backend/routes/` → thin HTTP controllers
- `backend/services/` → business rules and workflows
- `backend/repositories/` → data access (SQLAlchemy sessions)
- `backend/db/` → ORM models + session lifecycle

---

## Roles & Permissions (UI + API)

- **Admin**: full access (assets, transactions, maintenance, users, dashboard)
- **Viewer**: read-only access to asset inventory and asset detail screens

The React UI hides navigation items based on role, and the backend enforces role checks on protected endpoints.

---

## Database Schema (PostgreSQL)

Key entities:

- `users`: application users (role + active flag)
- `asset_master`: asset records (status, location, department, warranty info, QR metadata)
- `asset_transaction`: assignment/transfer history (audit trail)
- `maintenance`: repair/issue records
- `activity_log`: additional audit events (asset/user updates, maintenance events)

Schema and seed users are in `database_schema_postgres.sql`.

---

## Configuration

The backend loads environment variables from `backend/.env`.

### Required (Local DB + JWT)

Create `backend/.env` (example below). **Do not commit real secrets.**

```dotenv
# --- Database ---
WS_DB_HOST=localhost
WS_DB_PORT=5432
WS_DB_USER=postgres
WS_DB_PASSWORD=YOUR_PASSWORD
WS_DB_NAME=worksphere

# --- JWT ---
WS_SECRET_KEY=change-me
WS_TOKEN_EXPIRE_MINUTES=480
```

### Optional (Microsoft Entra ID / Azure AD OAuth)

If you want “Continue with Microsoft” login:

```dotenv
AZURE_TENANT_ID=YOUR_TENANT_ID
AZURE_CLIENT_ID=YOUR_CLIENT_ID
AZURE_CLIENT_SECRET=YOUR_CLIENT_SECRET

# Must point to the backend callback endpoint:
MS_REDIRECT_URI=http://127.0.0.1:8001/auth/microsoft/callback

# Where the backend redirects after login:
FRONTEND_URL=http://127.0.0.1:3000
```

Notes:

- Azure redirect URI must be registered to match `MS_REDIRECT_URI`.
- Graph employee endpoints require appropriate Graph permissions + admin consent.

---

## Running Locally (Development)

### Prerequisites

- Python 3.11+ recommended
- Node.js 18+ recommended
- PostgreSQL (and `psql` client)

---

### 1) Start PostgreSQL & Create Schema

Run the SQL script:

```bash
psql -U postgres -f database_schema_postgres.sql

```

This creates the `worksphere` database, tables, and seed users.

Default test users (username/password):

- `admin1 / admin1` (Admin)
- `viewer1 / viewer1` (Viewer)

---

### 2) Start the Backend (FastAPI)

From the backend folder:

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

URLs:

- API: `http://127.0.0.1:8001/`
- Swagger: `http://127.0.0.1:8001/docs`
- Static QR images: `http://127.0.0.1:8001/static/qrcodes/...`

---

### 3) Start the Frontend (React / Vite)

From the React frontend folder:

```bash
cd frontend-react
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

Frontend URL:

- `http://127.0.0.1:3000`

#### Pointing the frontend to a different API URL

By default the frontend uses `http://localhost:8001` for local dev. To override, set `VITE_API_URL`.

PowerShell:

```powershell
$env:VITE_API_URL = "http://127.0.0.1:8001"
npm run dev -- --host 127.0.0.1 --port 3000
```

bash:

```bash
VITE_API_URL=http://127.0.0.1:8001 npm run dev -- --host 127.0.0.1 --port 3000
```

---

## Production-style Setup (Backend serves the React build)

1) Build React:

```bash
cd frontend-react
npm install
npm run build
```

2) Start backend normally:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

3) Open:

- App: `http://127.0.0.1:8001/app/`

The backend mounts the React build if `frontend-react/dist` exists.

---

## Main API Endpoints (High Level)

Auth:

- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/microsoft/login` (optional)
- `GET /auth/microsoft/callback` (optional)
- `GET /auth/microsoft/employees` (admin-only, optional)
- `POST /auth/microsoft/import-users` (admin-only, optional)

Assets:

- `GET /assets/meta/dropdowns`
- `GET /assets` (paged list + filters)
- `GET /assets/{asset_id}` (details + history)
- `POST /assets`
- `PUT /assets/{asset_id}`
- `PATCH /assets/{asset_id}/available`
- `PATCH /assets/{asset_id}/retire`
- `POST /assets/{asset_id}/qr`

Transactions:

- `GET /transactions`
- `POST /transactions/assign`
- `POST /transactions/transfer`

Maintenance:

- `GET /maintenance`
- `POST /maintenance`
- `PUT /maintenance/{maintenance_id}`
- `PATCH /maintenance/{maintenance_id}/close`

Dashboard:

- `GET /dashboard`

---

## Notes & Troubleshooting

- **401 redirects in the UI**: the frontend clears the token and redirects to `/login` if the API returns 401.
- **CORS**: backend currently allows all origins for development.
- **QR images** are written to `backend/static/qrcodes/` and served under `/static/qrcodes`.
- **Retired assets**: by default, active inventory hides retired assets unless explicitly filtered.

---

## Reference Documentation

- `PROJECT_DOCUMENTATION.md`
- `database_schema_postgres.sql`
