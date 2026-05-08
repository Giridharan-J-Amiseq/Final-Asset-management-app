"""Maintenance endpoints.

Maintenance records track repairs/issues and drive asset status transitions.
"""

from fastapi import APIRouter, Depends

from auth import CurrentUser, require_roles
from constants import EDITOR_ROLES, MAINTENANCE_PREFIX
from schemas import MaintenanceCreate, MaintenanceUpdate
from services.maintenance_service import MaintenanceService


class MaintenanceController:
    """Registers maintenance endpoints and delegates repair workflows to the service layer."""

    def __init__(self, service: MaintenanceService | None = None):
        """Create the APIRouter and bind endpoint methods."""

        self.service = service or MaintenanceService()
        self.router = APIRouter(prefix=MAINTENANCE_PREFIX, tags=["Maintenance"])
        self.register_routes()

    def register_routes(self) -> None:
        """Attach maintenance endpoint methods to the router."""

        self.router.add_api_route("", self.list_maintenance, methods=["GET"])
        self.router.add_api_route("", self.create_maintenance, methods=["POST"])
        self.router.add_api_route("/{maintenance_id}", self.update_maintenance, methods=["PUT"])
        self.router.add_api_route("/{maintenance_id}/close", self.close_maintenance, methods=["PATCH"])

    def list_maintenance(self, _: CurrentUser):
        """Return maintenance records with related asset context."""

        return self.service.list_maintenance()

    def create_maintenance(self, payload: MaintenanceCreate, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Log a maintenance issue for an asset."""

        return self.service.create_maintenance(payload, current_user)

    def update_maintenance(self, maintenance_id: int, payload: MaintenanceUpdate, _: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Update editable maintenance fields."""

        return self.service.update_maintenance(maintenance_id, payload)

    def close_maintenance(self, maintenance_id: int, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Close a maintenance issue and make the asset available."""

        return self.service.close_maintenance(maintenance_id, current_user)


def get_router() -> APIRouter:
    """Create and return the maintenance router during application configuration."""

    return MaintenanceController().router
