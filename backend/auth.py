"""Authentication and authorization utilities.

This module provides:
- a schema-compatible password hash helper (SHA-256)
- JWT creation/verification
- FastAPI dependencies for current-user and role-based access control
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from config import settings
from constants import LOGIN_PATH
from repositories.user_repository import UserRepository


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=LOGIN_PATH)


def hash_password(password: str) -> str:
    """Hash plain-text passwords using the schema-compatible SHA-256 format."""

    return hashlib.sha256(password.encode("utf-8")).hexdigest()


class AuthService:
    """Handles authentication, JWT creation, and current-user lookup."""

    def __init__(self, user_repository: UserRepository | None = None):
        """Wire authentication to user persistence."""

        self.user_repository = user_repository or UserRepository()
        self.security = settings.security

    def create_access_token(self, data: dict, expires_delta: timedelta | None = None) -> str:
        """Create a signed JWT containing identity and role claims."""

        missing = self.security.missing_fields()
        if missing:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"JWT configuration is missing: {', '.join(missing)}",
            )
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=self.security.access_token_expire_minutes))
        to_encode.update({"exp": expire})
        try:
            return jwt.encode(to_encode, self.security.secret_key, algorithm=self.security.algorithm)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create access token.",
            ) from exc

    def authenticate_user(self, username: str, password: str) -> dict | None:
        """Validate username, active status, and password hash."""

        user = self.user_repository.find_by_username(username)
        if not user or not user["is_active"]:
            return None
        if user["password_hash"] != hash_password(password):
            return None
        return user

    def get_user_from_token(self, token: str) -> dict:
        """Decode a bearer token and return the active user it represents."""

        missing = self.security.missing_fields()
        if missing:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"JWT configuration is missing: {', '.join(missing)}",
            )
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed. Check the token and WS_SECRET_KEY configuration.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jwt.decode(token, self.security.secret_key, algorithms=[self.security.algorithm])
            user_id = payload.get("sub")
            if user_id is None:
                raise credentials_exception
        except JWTError as exc:
            raise credentials_exception from exc

        user = self.user_repository.find_by_id(user_id)
        if not user or not user["is_active"]:
            raise credentials_exception
        return user


auth_service = AuthService()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Compatibility wrapper used by route modules to create JWT tokens."""

    return auth_service.create_access_token(data, expires_delta)


def authenticate_user(username: str, password: str) -> dict | None:
    """Compatibility wrapper used by the login endpoint."""

    return auth_service.authenticate_user(username, password)


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    """FastAPI dependency that resolves the authenticated user from the bearer token."""

    return auth_service.get_user_from_token(token)


def require_roles(*roles: str):
    """Return a dependency that allows only users with one of the supplied roles."""

    def role_checker(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
        """Validate that the current user's role is allowed for a route."""

        if current_user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return role_checker


CurrentUser = Annotated[dict, Depends(get_current_user)]
