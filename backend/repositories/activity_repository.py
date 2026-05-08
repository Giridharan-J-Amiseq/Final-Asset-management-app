"""Activity/audit logging persistence.

Used to record significant actions (asset updates, maintenance events, user changes)
for traceability.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select

from db.models import ActivityLog, User
from db.session import engine, session_scope


class ActivityRepository:
    """Persists and queries auditable activity logs.

    The repository auto-creates the `activity_log` table if it is missing.
    """

    def __init__(self) -> None:
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        ActivityLog.__table__.create(bind=engine, checkfirst=True)

    def create_log(
        self,
        *,
        entity_type: str,
        entity_id: int,
        action: str,
        performed_by: int | None,
        details: dict[str, Any] | str | None = None,
        created_on: datetime | None = None,
    ) -> int:
        """Insert an activity log record and return its id."""

        payload: str | None
        if isinstance(details, dict):
            payload = json.dumps(details, default=str, ensure_ascii=False)
        elif details is None:
            payload = None
        else:
            payload = str(details)

        with session_scope() as session:
            row = ActivityLog(
                entity_type=str(entity_type)[:30],
                entity_id=int(entity_id),
                action=str(action)[:80],
                details=payload,
                performed_by=int(performed_by) if performed_by is not None else None,
                created_on=created_on or datetime.utcnow(),
            )
            session.add(row)
            session.flush()
            return int(row.log_id)

    def list_logs(self, *, entity_type: str, entity_id: int, limit: int = 100) -> list[dict[str, Any]]:
        """Return logs for a single entity, newest first."""

        limit_value = max(1, min(int(limit or 100), 500))

        with session_scope() as session:
            rows = session.execute(
                select(ActivityLog, User.user_name)
                .outerjoin(User, User.user_id == ActivityLog.performed_by)
                .where(ActivityLog.entity_type == entity_type, ActivityLog.entity_id == int(entity_id))
                .order_by(ActivityLog.created_on.desc(), ActivityLog.log_id.desc())
                .limit(limit_value)
            ).all()

            payload: list[dict[str, Any]] = []
            for log, performed_by_name in rows:
                payload.append(
                    {
                        "log_id": log.log_id,
                        "entity_type": log.entity_type,
                        "entity_id": log.entity_id,
                        "action": log.action,
                        "details": log.details,
                        "performed_by": log.performed_by,
                        "performed_by_name": performed_by_name,
                        "created_on": log.created_on,
                    }
                )
            return payload
