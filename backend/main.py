"""FastAPI application entrypoint for WorkSphere.

Responsibilities:
- configure middleware (CORS, sessions)
- configure optional Microsoft OAuth login
- mount static assets (QR codes) and optionally the built React app
- register feature routers (assets, users, transactions, maintenance, dashboard)
"""

from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx
from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from auth import CurrentUser, authenticate_user, create_access_token, require_roles
from config import settings
from constants import FRONTEND_APP_PATH, LOGIN_PATH, ROOT_PATH, STATIC_PATH
from db.session import verify_database_connection
from routes.router_manager import RouterManager
from schemas import LoginRequest, TokenResponse
from services.user_service import UserService


class SpaStaticFiles(StaticFiles):
    """Static file handler with SPA fallback.

    Starlette's StaticFiles serves real files but returns 404 for client-side
    routes like `/app/dashboard`. For browser navigations (Accept: text/html)
    and extension-less paths, we fall back to `index.html`.
    """

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code != 404:
            return response

        if scope.get("type") != "http":
            return response

        accept = b""
        for key, value in scope.get("headers") or []:
            if key.lower() == b"accept":
                accept = value
                break

        if b"text/html" not in accept:
            return response

        if Path(path).suffix:
            return response

        return await super().get_response("index.html", scope)


class WorkSphereApplication:
    """Builds and configures the WorkSphere FastAPI application."""

    def __init__(self):
        """Create the FastAPI instance and register middleware, static files, and routers."""

        self.app = FastAPI(title=settings.title, version=settings.version)
        self.oauth: OAuth | None = None
        self.configure_middleware()
        self.configure_oauth()
        self.configure_static_files()
        self.configure_routes()
        self.configure_startup()

    def configure_startup(self) -> None:
        """Register startup checks for required dependencies."""

        self.app.add_event_handler("startup", self.on_startup)

    def on_startup(self) -> None:
        """Validate external dependencies on startup."""

        verify_database_connection()

    def configure_middleware(self) -> None:
        """Configure cross-origin access for the React frontend and API clients."""

        # Required for OAuth state/nonce handling.
        self.app.add_middleware(
            SessionMiddleware,
            secret_key=settings.security.secret_key,
            same_site="lax",
            https_only=False,
        )

        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def configure_oauth(self) -> None:
        """Register the Microsoft OAuth client when Azure settings are provided."""

        if not settings.azure.is_configured:
            self.oauth = None
            return

        tenant = settings.azure.tenant_id
        metadata_url = f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"
        oauth = OAuth()
        oauth.register(
            name="microsoft",
            client_id=settings.azure.client_id,
            client_secret=settings.azure.client_secret,
            server_metadata_url=metadata_url,
            client_kwargs={"scope": "openid profile email User.Read"},
        )
        self.oauth = oauth

    def configure_static_files(self) -> None:
        """Mount generated QR files and the React production build when it exists."""

        static_dir = Path(__file__).resolve().parent / "static"
        self.app.mount(STATIC_PATH, StaticFiles(directory=static_dir), name="static")

        react_dist_dir = Path(__file__).resolve().parent.parent / "frontend-react" / "dist"
        if react_dist_dir.exists():
            self.app.mount(FRONTEND_APP_PATH, SpaStaticFiles(directory=react_dist_dir, html=True), name="app")

    def configure_routes(self) -> None:
        """Register root, login, and feature routers."""

        self.app.add_api_route(ROOT_PATH, self.root, methods=["GET"])
        self.app.add_api_route(LOGIN_PATH, self.login, methods=["POST"], response_model=TokenResponse)
        self.app.add_api_route("/auth/me", self.me, methods=["GET"])
        self.app.add_api_route("/auth/microsoft/login", self.microsoft_login, methods=["GET"])
        self.app.add_api_route("/auth/microsoft/callback", self.microsoft_callback, methods=["GET"])
        self.app.add_api_route("/auth/microsoft/employees", self.microsoft_employees, methods=["GET"])
        self.app.add_api_route("/auth/microsoft/import-users", self.microsoft_import_users, methods=["POST"])
        RouterManager(self.app).register_feature_routers()

    def root(self) -> dict[str, str]:
        """Return a lightweight health response for manual checks and deployment probes."""

        return {
            "message": "WorkSphere API is running",
            "frontend": FRONTEND_APP_PATH,
            "docs": "/docs",
        }

    def login(self, payload: LoginRequest) -> dict:
        """Authenticate a user and return a bearer token plus safe user profile data."""

        user = authenticate_user(payload.username, payload.password)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        access_token = create_access_token({"sub": str(user["user_id"]), "role": user["role"], "username": user["username"]})
        user.pop("password_hash", None)
        return {"access_token": access_token, "token_type": "bearer", "user": user}

    def me(self, current_user: CurrentUser) -> dict:
        """Return the currently authenticated user profile."""

        return current_user

    async def microsoft_login(self, request: Request):
        """Begin the Microsoft OAuth flow by redirecting to the authorization URL."""

        if not self.oauth:
            raise HTTPException(status_code=501, detail="Microsoft login is not configured")
        redirect_uri = self._resolve_microsoft_redirect_uri(request)
        return await self.oauth.microsoft.authorize_redirect(request, redirect_uri)

    def _resolve_microsoft_redirect_uri(self, request: Request) -> str:
        """Return the redirect URI used for Microsoft OAuth.

        In local development, the frontend/backend can be accessed via either
        `localhost` or `127.0.0.1`. OAuth state is stored in a host-scoped session
        cookie, so if the login is initiated on one hostname and the callback
        returns to the other, Authlib raises `mismatching_state`.

        To make local dev robust, when the configured redirect URI uses a loopback
        host and the current request also uses a loopback host, we rewrite the
        redirect URI to match the request host (keeping the configured path).
        """

        configured = settings.azure.redirect_uri
        if not configured:
            base_url = str(request.base_url).rstrip("/")
            return f"{base_url}/auth/microsoft/callback"

        parsed = urlparse(configured)
        configured_host = (parsed.hostname or "").lower()
        request_host = (request.url.hostname or "").lower()
        loopbacks = {"localhost", "127.0.0.1"}
        if configured_host in loopbacks and request_host in loopbacks:
            base_url = str(request.base_url).rstrip("/")
            return f"{base_url}{parsed.path}"

        return configured

    async def microsoft_callback(self, request: Request):
        """Handle the Microsoft OAuth callback, create/login a local user, and redirect to the frontend."""

        if not self.oauth:
            raise HTTPException(status_code=501, detail="Microsoft login is not configured")

        try:
            token = await self.oauth.microsoft.authorize_access_token(request)
        except OAuthError as exc:
            raise HTTPException(status_code=400, detail=f"Microsoft login failed: {exc.error}") from exc

        access_token = token.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Microsoft login did not return an access token")

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Failed to fetch Microsoft profile")

        profile = response.json()
        email = profile.get("mail") or profile.get("userPrincipalName")
        display_name = profile.get("displayName")

        user_service = UserService()
        user = user_service.ensure_microsoft_user(email=email, display_name=display_name)
        app_token = create_access_token({"sub": str(user["user_id"]), "role": user["role"], "username": user["username"]})

        callback_url = f"{settings.azure.frontend_url.rstrip('/')}/auth/callback?{urlencode({'token': app_token})}"
        return RedirectResponse(url=callback_url)

    async def _graph_app_token(self) -> str:
        """Fetch an application (client credentials) token for Microsoft Graph."""

        if not settings.azure.is_configured:
            raise HTTPException(status_code=501, detail="Microsoft login is not configured")

        token_url = f"https://login.microsoftonline.com/{settings.azure.tenant_id}/oauth2/v2.0/token"
        data = {
            "client_id": settings.azure.client_id,
            "client_secret": settings.azure.client_secret,
            "grant_type": "client_credentials",
            "scope": "https://graph.microsoft.com/.default",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(token_url, data=data)

        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Failed to obtain Microsoft Graph token")

        access_token = response.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Microsoft Graph token response was missing access_token")

        return access_token

    async def microsoft_employees(
        self,
        _: dict = Depends(require_roles("Admin")),
        top: int = Query(50, ge=1, le=200),
    ) -> dict:
        """Return employees from Microsoft Graph (requires admin + Graph directory permissions)."""

        token = await self._graph_app_token()
        url = "https://graph.microsoft.com/v1.0/users"
        params = {
            "$select": "displayName,mail,userPrincipalName",
            "$top": str(top),
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"}, params=params)

        if response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Microsoft Graph denied access. Ensure your Azure app has User.Read.All (Application) and admin consent.",
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Failed to fetch employees from Microsoft Graph")

        payload = response.json()
        employees = []
        for item in payload.get("value", []) or []:
            email = item.get("mail") or item.get("userPrincipalName")
            employees.append(
                {
                    "display_name": item.get("displayName"),
                    "email": email,
                }
            )

        return {"count": len(employees), "employees": employees, "next_link": payload.get("@odata.nextLink")}

    async def microsoft_import_users(
        self,
        _: dict = Depends(require_roles("Admin")),
        top: int = Query(50, ge=1, le=200),
    ) -> dict:
        """Import employees from Microsoft Graph into the local users table as Viewer users.

        Microsoft Graph paginates results; this endpoint follows `@odata.nextLink`
        until all pages are processed.
        """

        token = await self._graph_app_token()
        headers = {"Authorization": f"Bearer {token}"}

        next_url: str | None = "https://graph.microsoft.com/v1.0/users"
        next_params: dict | None = {
            "$select": "displayName,mail,userPrincipalName",
            "$top": str(top),
        }

        user_service = UserService()
        created = 0
        skipped = 0
        fetched = 0
        pages = 0

        async with httpx.AsyncClient(timeout=30) as client:
            while next_url:
                response = await client.get(next_url, headers=headers, params=next_params)
                pages += 1

                if response.status_code == 403:
                    raise HTTPException(
                        status_code=403,
                        detail="Microsoft Graph denied access. Ensure your Azure app has User.Read.All (Application) and admin consent.",
                    )
                if response.status_code >= 400:
                    raise HTTPException(status_code=400, detail="Failed to fetch employees from Microsoft Graph")

                payload = response.json() or {}
                items = payload.get("value", []) or []
                fetched += len(items)

                for item in items:
                    email = item.get("mail") or item.get("userPrincipalName")
                    if not email:
                        skipped += 1
                        continue

                    email_value = email.strip().lower()
                    existing = user_service.repository.find_by_email(email_value)
                    if existing:
                        skipped += 1
                        continue

                    try:
                        user_service.ensure_microsoft_user(email=email_value, display_name=item.get("displayName"))
                        created += 1
                    except HTTPException:
                        # Don't fail the entire import if one user record can't be created.
                        skipped += 1

                next_url = payload.get("@odata.nextLink")
                next_params = None  # nextLink already contains query params

        return {
            "imported": created,
            "skipped": skipped,
            "requested": top,
            "fetched": fetched,
            "pages": pages,
        }


app = WorkSphereApplication().app
