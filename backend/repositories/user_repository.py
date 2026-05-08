"""User persistence (repository layer)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select

from db.models import User
from db.serialization import model_to_dict
from db.session import session_scope


class UserRepository:
    """Provides persistence operations for user accounts."""

    def find_by_username(self, username: str) -> dict[str, Any] | None:
        """Return an active or inactive user by login username."""

        with session_scope() as session:
            user = session.execute(select(User).where(User.username == username).limit(1)).scalar_one_or_none()
            return model_to_dict(user) if user else None

    def find_by_id(self, user_id: int | str) -> dict[str, Any] | None:
        """Return a user by primary key without the password hash."""

        try:
            user_id_value = int(user_id)
        except (TypeError, ValueError):
            return None

        with session_scope() as session:
            user = session.get(User, user_id_value)
            if not user:
                return None
            payload = model_to_dict(user)
            payload.pop("password_hash", None)
            return payload

    def find_by_email(self, email: str) -> dict[str, Any] | None:
        """Return an active or inactive user by email."""

        with session_scope() as session:
            user = session.execute(select(User).where(User.email == email).limit(1)).scalar_one_or_none()
            if not user:
                return None
            payload = model_to_dict(user)
            payload.pop("password_hash", None)
            return payload

    def find_existing_identity(self, username: str, email: str) -> dict[str, Any] | None:
        """Return a user when username or email is already taken."""

        with session_scope() as session:
            user = (
                session.execute(
                    select(User.user_id)
                    .where(or_(User.username == username, User.email == email))
                    .limit(1)
                )
                .first()
            )
            return {"user_id": user[0]} if user else None

    def list_assignable(self) -> list[dict[str, Any]]:
        """Return active users that can receive asset assignments."""

        with session_scope() as session:
            rows = session.execute(
                select(User)
                .where(User.is_active.is_(True))
                .order_by(User.user_name.asc())
            ).scalars().all()
            payload = []
            for user in rows:
                item = model_to_dict(user)
                item.pop("password_hash", None)
                payload.append(item)
            return payload

    def list_users(self) -> list[dict[str, Any]]:
        """Return the admin user directory."""

        with session_scope() as session:
            rows = session.execute(select(User).order_by(User.user_name.asc())).scalars().all()
            payload = []
            for user in rows:
                item = model_to_dict(user)
                item.pop("password_hash", None)
                payload.append(item)
            return payload

    def create_user(self, payload, password_hash: str) -> int:
        """Insert a user and return the generated id."""

        with session_scope() as session:
            user = User(
                user_name=payload.user_name,
                username=payload.username,
                email=payload.email,
                password_hash=password_hash,
                role=payload.role,
                is_active=payload.is_active,
            )
            session.add(user)
            session.flush()
            return int(user.user_id)

    def create_user_identity(
        self,
        *,
        user_name: str,
        username: str,
        email: str,
        password_hash: str,
        role: str,
        is_active: bool = True,
    ) -> int:
        """Insert a user without requiring a Pydantic payload object."""

        with session_scope() as session:
            user = User(
                user_name=user_name,
                username=username,
                email=email,
                password_hash=password_hash,
                role=role,
                is_active=is_active,
            )
            session.add(user)
            session.flush()
            return int(user.user_id)

    def update_user_fields(self, user_id: int, data: dict[str, Any]) -> None:
        """Update selected user fields without changing unspecified columns."""

        allowed_fields = {"user_name", "username", "email", "role", "is_active", "password_hash"}
        filtered = {key: value for key, value in data.items() if key in allowed_fields}
        if not filtered:
            return

        with session_scope() as session:
            user = session.get(User, user_id)
            if not user:
                return
            for key, value in filtered.items():
                setattr(user, key, value)

    def deactivate_user(self, user_id: int) -> None:
        """Deactivate a user while preserving historical audit references."""

        with session_scope() as session:
            user = session.get(User, user_id)
            if user:
                user.is_active = False
