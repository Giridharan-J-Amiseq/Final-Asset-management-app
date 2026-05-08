"""Transaction business logic.

Implements assignment and transfer rules, including status validations.
"""

from typing import Any

from fastapi import HTTPException

from constants import STATUS_ASSIGNED, STATUS_AVAILABLE
from services.asset_service import AssetService
from repositories.asset_repository import AssetRepository
from repositories.transaction_repository import TransactionRepository
from repositories.user_repository import UserRepository
from schemas import AssignmentRequest, TransferRequest


class TransactionService:
    """Coordinates asset assignment and transfer rules."""

    def __init__(
        self,
        transaction_repository: TransactionRepository | None = None,
        asset_repository: AssetRepository | None = None,
        user_repository: UserRepository | None = None,
        asset_service: AssetService | None = None,
    ):
        """Wire the service to repositories needed for movement workflows."""

        self.transaction_repository = transaction_repository or TransactionRepository()
        self.asset_repository = asset_repository or AssetRepository()
        self.user_repository = user_repository or UserRepository()
        self.asset_service = asset_service or AssetService(self.asset_repository)

    def list_transactions(self, search: str | None = None) -> list[dict[str, Any]]:
        """Return all transaction history rows."""

        return self.transaction_repository.list_transactions(search)

    def find_asset_or_404(self, asset_id: int) -> dict[str, Any]:
        """Return an asset or raise a 404 response."""

        asset = self.asset_repository.find_by_id(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return asset

    def find_assignable_user_or_404(self, user_id: int) -> dict[str, Any]:
        """Return an active user or raise a 404 response."""

        user = self.user_repository.find_by_id(user_id)
        if not user or not user["is_active"]:
            raise HTTPException(status_code=404, detail="Assignee not found or inactive")
        return user

    def assign_asset(self, payload: AssignmentRequest, current_user: dict[str, Any]) -> dict[str, str]:
        """Assign an available asset to an active user."""

        asset = self.find_asset_or_404(payload.asset_id)
        self.find_assignable_user_or_404(payload.to_assignee)
        if asset["asset_status"] != STATUS_AVAILABLE:
            raise HTTPException(status_code=400, detail="Only available assets can be assigned")
        self.transaction_repository.assign_asset(asset, payload.to_assignee, payload.remarks, current_user["user_id"])
        self.asset_service.generate_qr(payload.asset_id)
        return {"message": "Asset assigned successfully"}

    def transfer_asset(self, payload: TransferRequest, current_user: dict[str, Any]) -> dict[str, Any]:
        """Transfer an already assigned asset to a different active user."""

        asset = self.find_asset_or_404(payload.asset_id)
        self.find_assignable_user_or_404(payload.to_assignee)
        if asset["asset_status"] != STATUS_ASSIGNED:
            raise HTTPException(status_code=400, detail="Only assigned assets can be transferred")
        previous = self.transaction_repository.latest_assignee(payload.asset_id)
        if not previous or not previous["to_assignee"]:
            raise HTTPException(status_code=400, detail="Transfer requires an existing assignee")
        self.transaction_repository.transfer_asset(
            asset,
            previous["to_assignee"],
            payload.to_assignee,
            payload.remarks,
            current_user["user_id"],
        )
        self.asset_service.generate_qr(payload.asset_id)
        return {"message": "Asset transferred successfully", "from_employee": previous["to_assignee"]}
