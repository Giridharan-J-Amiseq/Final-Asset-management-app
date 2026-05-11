"""SQLAlchemy engine and session lifecycle.

`session_scope()` is used by repositories to ensure transactions are committed
or rolled back consistently.
"""

from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from config import settings


def _create_engine():
    """Create the SQLAlchemy engine using current application settings."""

    return create_engine(
        settings.database.url,
        pool_pre_ping=True,
        future=True,
    )


engine = _create_engine()


@event.listens_for(engine, "connect")
def _set_utc_timezone(dbapi_connection, _):
    """Force UTC for each DB session so server timestamps are stored in UTC."""

    cursor = dbapi_connection.cursor()
    cursor.execute("SET TIME ZONE 'UTC'")
    cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def verify_database_connection() -> None:
    """Validate the database connection on startup for clearer errors."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError as exc:
        details = (
            f"host={settings.database.host}, "
            f"port={settings.database.port}, "
            f"db={settings.database.dbname}, "
            f"user={settings.database.user}"
        )
        raise RuntimeError(
            "Database connection failed. Verify WS_DB_* values in backend/.env and "
            "confirm PostgreSQL is running. "
            f"Connection details: {details}"
        ) from exc
    except SQLAlchemyError as exc:
        raise RuntimeError("Database connection check failed due to an unexpected SQLAlchemy error.") from exc


@contextmanager
def session_scope() -> Session:
    """Provide a transactional scope around a series of operations."""

    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
