"""Runtime configuration for WorkSphere.

Settings are loaded from environment variables and `backend/.env` (for local dev).
"""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv


load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=False)


@dataclass(frozen=True)
class DatabaseSettings:
    """Stores database connection settings used by the connection pool."""

    host: str = os.getenv("WS_DB_HOST", "localhost")
    port: int = int(os.getenv("WS_DB_PORT", "5432"))
    user: str = os.getenv("WS_DB_USER", "postgres")
    password: str = os.getenv("WS_DB_PASSWORD", "")
    dbname: str = os.getenv("WS_DB_NAME", "worksphere")

    def as_dict(self) -> dict:
        """Return psycopg2-compatible keyword arguments for creating connections."""

        return {
            "host": self.host,
            "port": self.port,
            "user": self.user,
            "password": self.password,
            "dbname": self.dbname,
        }

    @property
    def url(self) -> str:
        """Return a SQLAlchemy database URL.

        Uses the psycopg2 driver for PostgreSQL.
        """

        user = quote_plus(self.user)
        password = quote_plus(self.password)
        host = self.host
        port = self.port
        name = self.dbname
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"


@dataclass(frozen=True)
class SecuritySettings:
    """Stores JWT and token lifetime settings for authentication."""

    secret_key: str = os.getenv("WS_SECRET_KEY", "worksphere-dev-secret-key")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = int(os.getenv("WS_TOKEN_EXPIRE_MINUTES", "480"))


@dataclass(frozen=True)
class AzureAdSettings:
    """Stores Microsoft Entra ID (Azure AD) OAuth settings for Microsoft login."""

    tenant_id: str = os.getenv("AZURE_TENANT_ID", "")
    client_id: str = os.getenv("AZURE_CLIENT_ID", "")
    client_secret: str = os.getenv("AZURE_CLIENT_SECRET", "")
    redirect_uri: str = os.getenv("MS_REDIRECT_URI", "http://127.0.0.1:8001/auth/microsoft/callback")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")

    @property
    def is_configured(self) -> bool:
        """Return True when the minimal configuration exists for OAuth."""

        return bool(self.tenant_id and self.client_id and self.client_secret and self.redirect_uri and self.frontend_url)


@dataclass(frozen=True)
class AppSettings:
    """Groups all runtime settings so application setup has one clear dependency."""

    title: str = "WorkSphere Asset Management System"
    version: str = "1.0.0"
    database: DatabaseSettings = DatabaseSettings()
    security: SecuritySettings = SecuritySettings()
    azure: AzureAdSettings = AzureAdSettings()


settings = AppSettings()
