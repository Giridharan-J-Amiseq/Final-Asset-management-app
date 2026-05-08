"""Maintenance persistence (repository layer)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from constants import MAINTENANCE_CLOSED, MAINTENANCE_OPEN, STATUS_AVAILABLE, STATUS_IN_REPAIR
from db.models import AssetMaster, Maintenance
from db.serialization import model_to_dict
from db.session import session_scope


class MaintenanceRepository:
    """Provides persistence operations for asset maintenance records."""

    def find_by_id(self, maintenance_id: int) -> dict[str, Any] | None:
        """Return a maintenance record by primary key."""

        with session_scope() as session:
            row = session.get(Maintenance, maintenance_id)
            return model_to_dict(row) if row else None

    def list_maintenance(self) -> list[dict[str, Any]]:
        """Return all maintenance records with basic asset context."""

        with session_scope() as session:
            rows = session.execute(
                select(
                    Maintenance,
                    AssetMaster.asset_name,
                    AssetMaster.serial_number,
                    AssetMaster.asset_status,
                )
                .join(AssetMaster, AssetMaster.asset_id == Maintenance.asset_id)
                .order_by(Maintenance.created_on.desc())
            ).all()

            payload: list[dict[str, Any]] = []
            for m, asset_name, serial_number, asset_status in rows:
                item = model_to_dict(m)
                item["asset_name"] = asset_name
                item["serial_number"] = serial_number
                item["asset_status"] = asset_status
                payload.append(item)
            return payload

    def create_maintenance(self, payload, current_user_id: int) -> None:
        """Create a maintenance record and move the asset into repair status."""

        with session_scope() as session:
            m = Maintenance(
                asset_id=payload.asset_id,
                issue_description=payload.issue_description,
                issue_type=payload.issue_type,
                warranty_applicable=payload.warranty_applicable,
                maintenance_status=MAINTENANCE_OPEN,
                vendor=payload.vendor,
                resolution_notes=payload.resolution_notes,
            )
            session.add(m)

            asset = session.get(AssetMaster, payload.asset_id)
            if asset:
                asset.asset_status = STATUS_IN_REPAIR
                asset.modified_by = current_user_id

    def update_maintenance_fields(self, maintenance_id: int, data: dict[str, Any]) -> None:
        """Update selected maintenance fields without changing unspecified columns."""

        allowed_fields = {
            "issue_description",
            "issue_type",
            "warranty_applicable",
            "maintenance_status",
            "vendor",
            "resolution_notes",
        }
        filtered = {key: value for key, value in data.items() if key in allowed_fields}
        if not filtered:
            return

        with session_scope() as session:
            row = session.get(Maintenance, maintenance_id)
            if not row:
                return
            for key, value in filtered.items():
                setattr(row, key, value)

    def close_maintenance(self, maintenance_id: int, asset_id: int, current_user_id: int) -> None:
        """Close a maintenance record and return the asset to available status."""

        with session_scope() as session:
            row = session.get(Maintenance, maintenance_id)
            if row:
                row.maintenance_status = MAINTENANCE_CLOSED

            asset = session.get(AssetMaster, asset_id)
            if asset:
                asset.asset_status = STATUS_AVAILABLE
                asset.modified_by = current_user_id
