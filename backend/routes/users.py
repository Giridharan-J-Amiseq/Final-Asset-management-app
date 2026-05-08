"""User management endpoints.

Admins can manage users; editor roles can list assignable users for workflows.
"""

from fastapi import APIRouter, Depends, status

from auth import require_roles
from constants import ADMIN_ROLE, EDITOR_ROLES, USERS_PREFIX
from schemas import ApiMessage, UserCreate, UserUpdate
from services.user_service import UserService


class UserController:
    """Registers user-management endpoints and delegates account rules to UserService."""

    def __init__(self, service: UserService | None = None):
        """Create the APIRouter and bind endpoint methods."""

        self.service = service or UserService()
        self.router = APIRouter(prefix=USERS_PREFIX, tags=["Users"])
        self.register_routes()

    def register_routes(self) -> None:
        """Attach user endpoint methods to the router."""

        self.router.add_api_route("/assignable", self.list_assignable_users, methods=["GET"])
        self.router.add_api_route("", self.list_users, methods=["GET"])
        self.router.add_api_route("", self.create_user, methods=["POST"], status_code=status.HTTP_201_CREATED)
        self.router.add_api_route("/{user_id}", self.get_user_detail, methods=["GET"])
        self.router.add_api_route("/{user_id}", self.update_user, methods=["PUT"])
        self.router.add_api_route("/{user_id}/deactivate", self.deactivate_user, methods=["PATCH"], response_model=ApiMessage)

    def list_assignable_users(self, _: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Return active users that can receive asset assignments."""

        return self.service.list_assignable_users()

    def list_users(self, _: dict = Depends(require_roles(ADMIN_ROLE))):
        """Return the admin user directory."""

        return self.service.list_users()

    def create_user(self, payload: UserCreate, _: dict = Depends(require_roles(ADMIN_ROLE))):
        """Create a new application user."""

        return self.service.create_user(payload)

    def get_user_detail(self, user_id: int, _: dict = Depends(require_roles(ADMIN_ROLE))):
        """Return one user with their currently assigned assets."""

        return self.service.get_user_detail(user_id)

    def update_user(self, user_id: int, payload: UserUpdate, _: dict = Depends(require_roles(ADMIN_ROLE))):
        """Update an existing user account."""

        return self.service.update_user(user_id, payload)

    def deactivate_user(self, user_id: int, current_user: dict = Depends(require_roles(ADMIN_ROLE))):
        """Deactivate an account without deleting audit history.

        Any assets currently assigned to the user are returned to Available.
        """

        return self.service.deactivate_user(user_id, current_user["user_id"])


def get_router() -> APIRouter:
    """Create and return the user router during application configuration."""

    return UserController().router
