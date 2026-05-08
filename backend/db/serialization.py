"""Serialization helpers for SQLAlchemy ORM models.

Repositories return dictionaries instead of ORM instances so the API layer
can safely JSON-encode responses without leaking session state.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import inspect


def model_to_dict(instance: Any) -> dict[str, Any]:
    """Convert a mapped ORM instance into a JSON-friendly dictionary.

    Notes:
    - Expects a SQLAlchemy mapped instance (not None).
    - Converts Decimal to float for JSON encoding.
    - Leaves date/datetime objects intact (FastAPI/JSON encoders handle them).
    """

    mapper = inspect(instance).mapper
    payload: dict[str, Any] = {}
    for attr in mapper.column_attrs:
        value = getattr(instance, attr.key)
        if isinstance(value, (datetime, date)):
            payload[attr.key] = value
        elif isinstance(value, Decimal):
            payload[attr.key] = float(value)
        else:
            payload[attr.key] = value
    return payload
