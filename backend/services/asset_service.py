"""Asset business logic.

Implements rules for creating/updating assets, generating asset codes and QR
payloads/images, and producing asset detail views.
"""

from datetime import datetime
from pathlib import Path
import random
import string
from typing import Any

from fastapi import HTTPException

from constants import (
    ASSET_CATEGORIES,
    ASSET_CODE_PREFIX,
    ASSET_DEPARTMENTS,
    ASSET_LOCATIONS,
    ASSET_STATUSES,
    ASSET_TYPES,
    CONDITION_STATUSES,
)
from repositories.asset_repository import AssetRepository
from repositories.activity_repository import ActivityRepository
from schemas import AssetCreate, AssetUpdate
from utils.qr_code import QRCodeGenerator


class AssetService:
    """Coordinates asset business rules, asset codes, and QR generation."""

    def __init__(self, repository: AssetRepository | None = None, qr_generator: QRCodeGenerator | None = None):
        """Wire the service to its repository and QR helper."""

        self.repository = repository or AssetRepository()
        self.activity_repository = ActivityRepository()
        qr_dir = Path(__file__).resolve().parent.parent / "static" / "qrcodes"
        self.qr_generator = qr_generator or QRCodeGenerator(qr_dir)
        self._asset_code_backfill_ready = False

    def dropdown_options(self) -> dict[str, list[str]]:
        """Return controlled values used by asset forms."""

        return {
            "locations": list(ASSET_LOCATIONS.keys()),
            "departments": list(ASSET_DEPARTMENTS.keys()),
            "asset_types": list(ASSET_TYPES),
            "asset_statuses": list(ASSET_STATUSES),
            "conditions": list(CONDITION_STATUSES),
            "categories": list(ASSET_CATEGORIES),
        }

    def build_asset_code(
        self,
        location: str | None,
        asset_type: str,
        serial_number: str,
        asset_code_seed: int | None = None,
    ) -> str:
        """Create the human-readable asset id used on cards and QR pages."""

        location_code = (location or "UNK")[:3].upper()
        asset_type_code = (asset_type or "UNK")[:3].upper()
        serial_suffix = (serial_number or "00000")[-5:].upper()
        suffix_source = random.Random(asset_code_seed if asset_code_seed is not None else 0)
        random_suffix = "".join(suffix_source.choices(string.ascii_uppercase + string.digits, k=2))
        return f"{ASSET_CODE_PREFIX}-{location_code}-{asset_type_code}-{serial_suffix}-{random_suffix}"

    def decorate_asset(self, asset: dict[str, Any]) -> dict[str, Any]:
        """Normalize asset output with internal and business-facing asset identifiers."""

        asset_copy = dict(asset)
        asset_copy["formatted_asset_id"] = asset_copy.get("asset_id")
        try:
            asset_copy["qr_code_value"] = int(asset_copy["qr_code_value"]) if asset_copy.get("qr_code_value") is not None else None
        except (TypeError, ValueError):
            asset_copy["qr_code_value"] = asset_copy.get("asset_code")
        return asset_copy

    def build_qr_payload(self, asset: dict[str, Any], transactions: list[dict[str, Any]] | None = None) -> str:
        """Build the readable text that a scanner displays after reading the QR code."""
        def safe(value: Any) -> str:
            if value is None:
                return "-"
            text = str(value).strip()
            return text if text else "-"

        return "\n".join(
            [
                f"Asset ID: {safe(asset.get('formatted_asset_id') or asset.get('asset_code'))}",
                f"Serial Number: {safe(asset.get('serial_number'))}",
                f"Location: {safe(asset.get('location'))}",
                f"Asset Type: {safe(asset.get('asset_type'))}",
            ]
        )

    def return_assets_from_user(self, user_id: int, modified_by: int) -> list[int]:
        """Return all assets currently assigned to a user back to Available."""

        try:
            user_id_value = int(user_id)
            modified_by_value = int(modified_by)
        except (TypeError, ValueError):
            return []

        return self.repository.return_assets_from_user(user_id_value, modified_by_value)

    def ensure_asset_code_values(self) -> None:
        """Backfill asset codes for old rows once per process."""

        if self._asset_code_backfill_ready:
            return

        for row in self.repository.find_assets_missing_codes():
            asset_code = self.repository.next_asset_code()
            self.repository.update_asset_code(row["asset_id"], asset_code)
        self._asset_code_backfill_ready = True

    def resolve_asset_or_404(self, asset_identifier: str) -> dict[str, Any]:
        """Return one asset by numeric database id or formatted asset id."""

        self.ensure_asset_code_values()
        asset = None
        identifier_text = str(asset_identifier).strip()
        if identifier_text.isdigit():
            asset = self.repository.find_by_asset_code(int(identifier_text))
        if not asset:
            asset = self.repository.find_by_id(identifier_text)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return self.decorate_asset(asset)

    def get_asset_or_404(self, asset_id: str) -> dict[str, Any]:
        """Return one asset or raise a 404 response."""

        return self.resolve_asset_or_404(asset_id)

    def list_assets(
        self,
        page: int,
        page_size: int,
        search: str | None = None,
        status_filter: str | None = None,
        type_filter: str | None = None,
        location: str | None = None,
        department: str | None = None,
    ) -> dict[str, Any]:
        """Return paginated assets after applying optional filters."""

        self.ensure_asset_code_values()

        total = self.repository.count_assets(
            search=search,
            status_filter=status_filter,
            type_filter=type_filter,
            location=location,
            department=department,
        )
        items = self.repository.list_assets(
            page=page,
            page_size=page_size,
            search=search,
            status_filter=status_filter,
            type_filter=type_filter,
            location=location,
            department=department,
        )
        return {"page": page, "page_size": page_size, "total": total, "items": [self.decorate_asset(item) for item in items]}

    def get_asset_detail(self, asset_id: str) -> dict[str, Any]:
        """Return asset master data with related transactions and maintenance records."""

        asset = self.get_asset_or_404(asset_id)
        internal_asset_id = asset["asset_id"]
        return {
            "asset": asset,
            "transactions": self.repository.list_transactions_for_asset(internal_asset_id),
            "maintenance": self.repository.list_maintenance_for_asset(internal_asset_id),
            "activity": self.activity_repository.list_logs(entity_type="asset", entity_id=internal_asset_id, limit=200),
        }

    def list_assets_assigned_to_user(self, user_id: int) -> list[dict[str, Any]]:
        """Return assets whose latest transaction assigns them to the user."""

        try:
            user_id_value = int(user_id)
        except (TypeError, ValueError):
            return []

        self.ensure_asset_code_values()
        rows = self.repository.list_assets_assigned_to_user(user_id_value)
        return [self.decorate_asset(row) for row in rows]

    def create_asset(self, payload: AssetCreate, current_user: dict[str, Any]) -> dict[str, Any]:
        """Create an asset, assign its final asset code, and generate its QR image."""

        self.ensure_asset_code_values()
        if self.repository.find_by_serial(payload.serial_number):
            raise HTTPException(status_code=400, detail="Serial number already exists")

        asset_code = self.repository.next_asset_code()
        asset_id = self.build_asset_code(payload.location, payload.asset_type, payload.serial_number, asset_code)
        self.repository.create_asset(payload, asset_id, asset_code, current_user["user_id"])
        qr_value = asset_code
        qr_payload = self.build_qr_payload(
            {
                "asset_id": asset_id,
                "asset_name": payload.asset_name,
            "asset_code": asset_code,
            "formatted_asset_id": asset_id,
                "serial_number": payload.serial_number,
                "asset_type": payload.asset_type,
                "category": payload.category,
                "department": payload.department,
                "location": payload.location,
                "condition_status": payload.condition_status,
                "brand": payload.brand,
                "model": payload.model,
                "asset_status": payload.asset_status,
                "purchase_date": payload.purchase_date,
                "purchase_cost": payload.purchase_cost,
                "vendor_name": payload.vendor_name,
                "invoice_number": payload.invoice_number,
                "warranty_start_date": payload.warranty_start_date,
                "warranty_expiry": payload.warranty_expiry,
            }
        )
        image_url = self.qr_generator.generate_for_asset(asset_id, qr_payload)
        self.repository.update_qr(asset_id, int(qr_value), image_url)
        return {
            "message": "Asset created successfully",
            "asset_id": asset_id,
            "asset_code": asset_code,
            "formatted_asset_id": asset_id,
            "qr_code_value": qr_value,
            "qr_code_image_url": image_url,
            "qr_payload": qr_payload,
        }

    def update_asset(self, asset_id: str, payload: AssetUpdate, current_user: dict[str, Any]) -> dict[str, Any]:
        """Apply partial asset updates after checking asset existence and serial uniqueness."""

        asset = self.get_asset_or_404(asset_id)
        internal_asset_id = asset["asset_id"]
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return {"message": "No changes supplied", "asset_id": internal_asset_id}
        if data.get("serial_number") and self.repository.find_by_serial(data["serial_number"], exclude_asset_id=internal_asset_id):
            raise HTTPException(status_code=400, detail="Serial number already exists")
        self.repository.update_asset_fields(internal_asset_id, data, current_user["user_id"])
        changes: dict[str, dict[str, Any]] = {}
        for key in data.keys():
            before_value = asset.get(key)
            after_value = data.get(key)
            if before_value != after_value:
                changes[key] = {"before": before_value, "after": after_value}

        if changes:
            self.activity_repository.create_log(
                entity_type="asset",
                entity_id=internal_asset_id,
                action="asset_updated",
                performed_by=current_user.get("user_id"),
                details={"changes": changes},
            )

        return {"message": "Asset updated successfully", "asset_before": asset}

    def retire_asset(self, asset_id: str, current_user: dict[str, Any]) -> dict[str, str]:
        """Retire an asset after confirming it exists."""

        asset = self.get_asset_or_404(asset_id)
        self.repository.retire_asset(asset["asset_id"], current_user["user_id"])
        self.activity_repository.create_log(
            entity_type="asset",
            entity_id=asset["asset_id"],
            action="asset_retired",
            performed_by=current_user.get("user_id"),
            details={"before": {"asset_status": asset.get("asset_status"), "is_retired": asset.get("is_retired")}, "after": {"asset_status": "Retired", "is_retired": True}},
        )
        return {"message": "Asset retired successfully"}

    def mark_available(self, asset_id: str, current_user: dict[str, Any]) -> dict[str, Any]:
        """Mark an asset as Available (return to inventory)."""

        asset = self.get_asset_or_404(asset_id)
        if asset.get("is_retired"):
            raise HTTPException(status_code=400, detail="Retired assets cannot be returned to Available")

        updated = self.repository.mark_available(asset["asset_id"], current_user["user_id"])
        if not updated:
            raise HTTPException(status_code=404, detail="Asset not found")

        self.activity_repository.create_log(
            entity_type="asset",
            entity_id=asset["asset_id"],
            action="asset_mark_available",
            performed_by=current_user.get("user_id"),
            details={"before": {"asset_status": asset.get("asset_status")}, "after": {"asset_status": "Available"}},
        )

        return {"message": "Asset marked available", "asset_id": asset["asset_id"], "asset_status": "Available"}

    def generate_qr(self, asset_id: str) -> dict[str, Any]:
        """Generate or refresh the QR code image for an asset."""

        asset = self.get_asset_or_404(asset_id)
        internal_asset_id = asset["asset_id"]
        transactions = self.repository.list_transactions_for_asset(internal_asset_id)
        qr_value = asset.get("qr_code_value") or asset.get("asset_code")
        qr_payload = self.build_qr_payload(asset, transactions)
        image_url = self.qr_generator.generate_for_asset(internal_asset_id, qr_payload)
        self.repository.update_qr(internal_asset_id, int(qr_value), image_url)
        return {
            "message": "QR code generated successfully",
            "qr_code_value": int(qr_value),
            "formatted_asset_id": asset.get("formatted_asset_id") or asset.get("asset_code"),
            "asset_name": asset.get("asset_name"),
            "serial_number": asset.get("serial_number"),
            "qr_code_image_url": image_url,
            "qr_payload": qr_payload,
        }

    def delete_asset(self, asset_id: str, current_user: dict[str, Any]) -> dict[str, str]:
        """Permanently delete an asset and related records."""

        asset = self.get_asset_or_404(asset_id)
        self._remove_qr_image(asset.get("qr_code_image_url"))
        deleted = self.repository.delete_asset_hard(asset["asset_id"])
        if not deleted:
            raise HTTPException(status_code=404, detail="Asset not found")

        self.activity_repository.create_log(
            entity_type="asset",
            entity_id=asset["asset_id"],
            action="asset_deleted",
            performed_by=current_user.get("user_id"),
            details={"asset_name": asset.get("asset_name")},
        )

        return {"message": "Asset deleted successfully"}

    def _remove_qr_image(self, qr_url: str | None) -> None:
        """Remove a local QR image file when deleting an asset."""

        if not qr_url:
            return

        static_root = Path(__file__).resolve().parent.parent / "static"
        if not qr_url.startswith("/static/"):
            return

        relative_path = qr_url.replace("/static/", "", 1)
        file_path = static_root / relative_path
        if file_path.exists():
            file_path.unlink()
