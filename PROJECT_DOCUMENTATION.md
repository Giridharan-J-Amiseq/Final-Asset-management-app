# WorkSphere Project Documentation

## Purpose

WorkSphere is an internal asset management application for tracking company assets, assigning and transferring assets to users, logging maintenance, and generating QR codes for physical tracking.

The application has two main parts:

- Backend API: FastAPI and PostgreSQL.
- Frontend UI: React, Vite, and Tailwind CSS.

The older HTML, CSS, and JavaScript frontend has been removed. The React application is now the only supported frontend.

## Architecture

The backend is organized into layers so each file has one clear responsibility.

### Application Layer

`backend/main.py`

Creates the FastAPI application, configures CORS, mounts static files, serves the React production build, registers login, and includes feature routers.

The `WorkSphereApplication` class keeps startup configuration in one place.

### Configuration Layer

`backend/config.py`

Contains typed settings classes:

- `DatabaseSettings`
- `SecuritySettings`
- `AppSettings`

Environment variables can override database and token settings:

- `WS_DB_HOST`
- `WS_DB_PORT`
- `WS_DB_USER`
- `WS_DB_PASSWORD`
- `WS_DB_NAME`
- `WS_SECRET_KEY`
- `WS_TOKEN_EXPIRE_MINUTES`

### Constants Layer

`backend/constants.py`

Contains shared role names, asset statuses, maintenance statuses, route prefixes, dropdown values, and QR/asset-code settings.

Use this file when a value is reused across routes, services, schemas, or repositories. This keeps business labels consistent and makes future changes easier for the team.

### Database Layer

`backend/database.py`

Contains `DatabaseManager`, which owns the PostgreSQL connection pool and transaction lifecycle.

Repositories use this class instead of opening their own database connections.

### Repository Layer

`backend/repositories/`

Repositories contain SQL only. They do not know about HTTP requests, FastAPI dependencies, or frontend behavior.

- `asset_repository.py`: asset CRUD, QR metadata, asset history queries.
- `user_repository.py`: user lookup, creation, update, deactivation.
- `transaction_repository.py`: assignments and transfers.
- `maintenance_repository.py`: repair and maintenance records.
- `dashboard_repository.py`: dashboard summary queries.

### Service Layer

`backend/services/`

Services contain business rules and workflows. They coordinate repositories and decide when to return errors.

- `asset_service.py`: asset codes, asset creation, QR generation, list filtering, retirement.
- `user_service.py`: user creation and account management.
- `transaction_service.py`: assignment and transfer rules.
- `maintenance_service.py`: maintenance workflows and asset repair status changes.
- `dashboard_service.py`: dashboard summary assembly.

### Route Layer

`backend/routes/`

Routes are thin controller classes. They define paths, HTTP methods, security dependencies, and request/response models. They delegate real work to services.

This keeps route files readable for teammates who need to understand the public API quickly.

`backend/routes/router_manager.py` is the single place where feature routers are registered with FastAPI.

### Schema Layer

`backend/schemas.py`

Pydantic models define API request and response contracts. They also validate fields before data reaches PostgreSQL.

Examples:

- purchase cost must fit the database column
- warranty expiry must be between 0 and 50 years
- purchase and warranty dates cannot be in the future

### Utility Layer

`backend/utils/qr_code.py`

Contains `QRCodeGenerator`, which creates QR PNG files under `backend/static/qrcodes`.

## Frontend Structure

`frontend-react/`

The React app uses Vite and Tailwind CSS.

Important folders:

- `src/app`: route configuration and app shell.
- `src/pages`: screen-level React pages.
- `src/components`: reusable UI components.
- `src/services`: API, auth, and formatting helpers.
- `src/styles`: Tailwind entry CSS.

The React dev server usually runs on:

`http://127.0.0.1:3000`

The backend-served production build is available at:

`http://127.0.0.1:8001/app/`

## Main Business Flows

### Login

1. User submits username and password.
2. Backend checks the user in PostgreSQL.
3. Backend validates SHA-256 password hash.
4. Backend returns a JWT token and user profile.
5. Frontend stores the token in local storage.
6. Future API requests include `Authorization: Bearer <token>`.

### Asset Creation

1. Admin fills the asset form.
2. Frontend sends `POST /assets`.
3. Backend validates the request with Pydantic.
4. `AssetService` checks duplicate serial numbers.
5. Asset row is inserted.
6. Asset code is generated and saved.
7. QR code image is generated and saved.
8. API returns the created asset id, asset code, and QR metadata.
9. React refreshes the list so the new asset appears immediately.

### Assignment

1. Admin selects an available asset and assignee.
2. Backend verifies the asset exists and is `Available`.
3. Backend verifies the user exists and is active.
4. A `New Asset` transaction is inserted.
5. The asset status changes to `Assigned`.

### Transfer

1. Admin selects an assigned asset and new assignee.
2. Backend finds the previous assignee from the latest transaction.
3. A transfer transaction is inserted.
4. The asset remains assigned.

### Maintenance

1. Admin logs an issue.
2. Backend verifies the asset exists.
3. A maintenance record is inserted.
4. The asset status changes to `In Repair`.
5. When maintenance is closed, the asset status changes back to `Available`.

## How To Start The Project

### 1. Start PostgreSQL

Make sure PostgreSQL is running and the `worksphere` database exists.

Use:

`database_schema_postgres.sql`

to create tables and seed users.

Default test users include:

- `admin1 / admin1`
- `viewer1 / viewer1`

### 2. Start Backend

From:

`backend`

Run:

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

API root:

`http://127.0.0.1:8001`

Swagger docs:

`http://127.0.0.1:8001/docs`

### 3. Start React Frontend

From:

`frontend-react`

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

If the backend is on `8001`, start Vite with:

```bash
set VITE_API_URL=http://127.0.0.1:8001&& npm run dev -- --host 127.0.0.1 --port 3000
```

Frontend:

`http://127.0.0.1:3000`

### 4. Build React For Backend Serving

From:

`frontend-react`

Run:

```bash
npm run build
```

The backend serves the build from:

`frontend-react/dist`

Backend-served app:

`http://127.0.0.1:8001/app/`

## Developer Notes

- Keep route files focused on HTTP concerns.
- Put SQL in repositories.
- Put business rules in services.
- Put reusable helpers in `utils`.
- Put request and response validation in `schemas.py`.
- Do not perform database work at import time.
- Use docstrings for classes and functions so future team members understand why each object exists.

## External Reference

This backend follows FastAPI's recommended larger-application approach: split route modules with `APIRouter`, keep the main app as the place that includes routers, and use package modules for maintainability.

Official FastAPI reference:

https://fastapi.tiangolo.com/tutorial/bigger-applications/
