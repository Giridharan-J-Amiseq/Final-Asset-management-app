# WorkSphere - Asset Management System

WorkSphere is an internal asset management platform for tracking company assets, assigning and transferring them between users, logging maintenance, extending warranty periods, and generating QR labels for physical tagging.

The repository contains:

- Backend API: FastAPI + PostgreSQL + SQLAlchemy ORM
- Frontend UI: React + Vite + Tailwind CSS

The backend can serve the built React app under `/app` in production.

---

## Features

- Asset inventory: create, update, list, filter, retire, and permanently delete
- QR codes: generate PNG QR labels; payload shows Asset ID, Serial Number, Location, Asset Type
- Assignment and transfer workflows with audit history
- Maintenance workflow with issue tracking and warranty extension
- Dashboard summary metrics
- Role-based access: Admin and Viewer
- Authentication:
  - Local username/password (SHA-256 hashes) with JWT bearer tokens
  - Optional Microsoft Entra ID (Azure AD) OAuth login + Graph employee import

---

## Tech Stack (What and Why)

### Backend

- FastAPI: fast, async-ready API framework with built-in validation and docs
- Uvicorn: ASGI server used to run FastAPI
- PostgreSQL: reliable relational database for transactional asset data
- SQLAlchemy ORM: clean data access layer and portable SQL
- python-jose: JWT signing and verification
- passlib[bcrypt]: password hashing utilities
- python-dotenv: local environment configuration
- qrcode[pil]: QR image generation
- pydantic: request/response validation and parsing
- authlib + httpx: Microsoft OAuth integration
- itsdangerous: session and OAuth state handling

### Frontend

- React: component-based UI for complex screens and flows
- React Router: client-side routing for multiple views
- Vite: fast dev server and production builds
- Tailwind CSS: rapid, consistent UI styling
- lucide-react: icon library
- clsx: conditional class handling

---

## Architecture Overview

The backend is layered so each folder has one clear responsibility:

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

- users: application users (role + active flag)
- asset_master: asset records (status, location, department, warranty info, QR metadata)
- asset_transaction: assignment/transfer history (audit trail)
- maintenance: repair, warranty extension, and resolution tracking
- activity_log: audit events (asset/user updates, maintenance events)

Schema and seed users are in `database_schema_postgres.sql`.

---

## Configuration

The backend loads environment variables from `backend/.env`.

### Required (Local DB + JWT)

Create `backend/.env` (example below). Do not commit real secrets.

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

### How to Connect to the Database

Use the same values from `backend/.env`.

- Host: `WS_DB_HOST`
- Port: `WS_DB_PORT`
- Database: `WS_DB_NAME`
- Username: `WS_DB_USER`
- Password: `WS_DB_PASSWORD`

psql example:

```bash
psql -h localhost -p 5432 -U postgres -d worksphere
```

Connection string format (for tools like pgAdmin, DBeaver, etc.):

```
postgresql://WS_DB_USER:WS_DB_PASSWORD@WS_DB_HOST:WS_DB_PORT/WS_DB_NAME
```

### Optional (Microsoft Entra ID / Azure AD OAuth)

If you want Continue with Microsoft login:

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

- Azure redirect URI must match MS_REDIRECT_URI
- Graph employee endpoints require appropriate Graph permissions and admin consent

---

## Running Locally (Development)

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (and psql client)

### 0) Create and Activate a Python Virtual Environment

PowerShell (recommended on Windows):

```powershell
cd backend
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& .\.venv\Scripts\Activate.ps1
```

bash:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

### 1) Start PostgreSQL and Create Schema

```bash
psql -U postgres -f database_schema_postgres.sql
```

Default test users (username/password):

- admin1 / admin1 (Admin)
- viewer1 / viewer1 (Viewer)

### 2) Start Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

URLs:

- API: http://127.0.0.1:8001/
- Swagger: http://127.0.0.1:8001/docs
- QR images: http://127.0.0.1:8001/static/qrcodes/...

### 3) Start Frontend

```bash
cd frontend-react
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

Frontend URL: http://127.0.0.1:3000

#### Pointing the frontend to a different API URL

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

## Production-Style Setup (Backend serves React)

1) Build React:

```bash
cd frontend-react
npm install
npm run build
```

2) Start backend:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

3) Open:

- App: http://127.0.0.1:8001/app/

---

## API Endpoints (High Level)

Auth:

- POST /auth/login
- GET /auth/me
- GET /auth/microsoft/login (optional)
- GET /auth/microsoft/callback (optional)
- GET /auth/microsoft/employees (admin-only, optional)
- POST /auth/microsoft/import-users (admin-only, optional)

Assets:

- GET /assets/meta/dropdowns
- GET /assets (paged list + filters)
- GET /assets/{asset_id} (details + history)
- POST /assets
- PUT /assets/{asset_id}
- PATCH /assets/{asset_id}/available
- PATCH /assets/{asset_id}/retire
- DELETE /assets/{asset_id} (hard delete)
- POST /assets/{asset_id}/qr

Transactions:

- GET /transactions
- POST /transactions/assign
- POST /transactions/transfer

Maintenance:

- GET /maintenance
- POST /maintenance
- PUT /maintenance/{maintenance_id}
- PATCH /maintenance/{maintenance_id}/close

Dashboard:

- GET /dashboard

---

## Business Rules (Summary)

- Assign: Only Available assets can be assigned
- Transfer: Only Assigned assets can be transferred
- Maintenance: Repair issues move asset to In Repair; Extend Warranty keeps current status
- Retire: Retired assets are hidden from active inventory by default
- Hard delete: Removes asset, transactions, maintenance, QR image, and activity log

---

## Notes and Troubleshooting

- 401 in UI: frontend clears the token and redirects to /login
- CORS: backend allows all origins for development
- QR images: stored in backend/static/qrcodes and served under /static/qrcodes
- Retired assets: hidden unless filtered for Retired

---

## Reference Documentation

- PROJECT_DOCUMENTATION.md
- database_schema_postgres.sql
