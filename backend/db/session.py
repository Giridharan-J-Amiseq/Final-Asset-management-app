"""SQLAlchemy engine and session lifecycle.

`session_scope()` is used by repositories to ensure transactions are committed
or rolled back consistently.
"""

from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import create_engine, event
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
