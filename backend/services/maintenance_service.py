"""Maintenance business logic.

Implements maintenance workflows and related asset status transitions.
"""

from typing import Any

from fastapi import HTTPException

from repositories.asset_repository import AssetRepository
from repositories.activity_repository import ActivityRepository
from repositories.maintenance_repository import MaintenanceRepository
from schemas import MaintenanceCreate, MaintenanceUpdate


class MaintenanceService:
    """Coordinates maintenance workflows and asset repair status changes."""

    def __init__(
        self,
        maintenance_repository: MaintenanceRepository | None = None,
        asset_repository: AssetRepository | None = None,
    ):
        """Wire the service to maintenance and asset repositories."""

        self.maintenance_repository = maintenance_repository or MaintenanceRepository()
        self.asset_repository = asset_repository or AssetRepository()
        self.activity_repository = ActivityRepository()

    def list_maintenance(self) -> list[dict[str, Any]]:
        """Return all maintenance records."""

        return self.maintenance_repository.list_maintenance()

    def get_maintenance_or_404(self, maintenance_id: int) -> dict[str, Any]:
        """Return a maintenance record or raise a 404 response."""

        record = self.maintenance_repository.find_by_id(maintenance_id)
        if not record:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
        return record

    def create_maintenance(self, payload: MaintenanceCreate, current_user: dict[str, Any]) -> dict[str, str]:
        """Create a maintenance issue for an existing asset."""

        if not self.asset_repository.find_by_id(payload.asset_id):
            raise HTTPException(status_code=404, detail="Asset not found")
        self.maintenance_repository.create_maintenance(payload, current_user["user_id"])
        self.activity_repository.create_log(
            entity_type="asset",
            entity_id=payload.asset_id,
            action="maintenance_logged",
            performed_by=current_user.get("user_id"),
            details={"issue_type": payload.issue_type},
        )
        return {"message": "Maintenance issue logged successfully"}

    def update_maintenance(self, maintenance_id: int, payload: MaintenanceUpdate) -> dict[str, str]:
        """Apply partial maintenance updates after verifying the record exists."""

        self.get_maintenance_or_404(maintenance_id)
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return {"message": "No changes supplied"}
        self.maintenance_repository.update_maintenance_fields(maintenance_id, data)
        return {"message": "Maintenance record updated successfully"}

    def close_maintenance(self, maintenance_id: int, current_user: dict[str, Any]) -> dict[str, str]:
        """Close maintenance and return the asset to available status."""

        record = self.get_maintenance_or_404(maintenance_id)
        self.maintenance_repository.close_maintenance(maintenance_id, record["asset_id"], current_user["user_id"])
        self.activity_repository.create_log(
            entity_type="asset",
            entity_id=record["asset_id"],
            action="maintenance_closed",
            performed_by=current_user.get("user_id"),
            details={"maintenance_id": maintenance_id},
        )
        return {"message": "Maintenance closed and asset marked available"}
