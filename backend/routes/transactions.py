"""Transaction endpoints.

Transactions represent assignment and transfer actions performed on assets.
"""

from fastapi import APIRouter, Depends, Query, status

from auth import CurrentUser, require_roles
from constants import EDITOR_ROLES, TRANSACTIONS_PREFIX
from schemas import AssignmentRequest, TransferRequest
from services.transaction_service import TransactionService


class TransactionController:
    """Registers transaction endpoints for assignment and transfer workflows."""

    def __init__(self, service: TransactionService | None = None):
        """Create the APIRouter and bind endpoint methods."""

        self.service = service or TransactionService()
        self.router = APIRouter(prefix=TRANSACTIONS_PREFIX, tags=["Transactions"])
        self.register_routes()

    def register_routes(self) -> None:
        """Attach transaction endpoint methods to the router."""

        self.router.add_api_route("", self.list_transactions, methods=["GET"])
        self.router.add_api_route("/assign", self.assign_asset, methods=["POST"], status_code=status.HTTP_201_CREATED)
        self.router.add_api_route("/transfer", self.transfer_asset, methods=["POST"], status_code=status.HTTP_201_CREATED)

    def list_transactions(self, _: CurrentUser, search: str | None = Query(default=None)):
        """Return the asset movement audit trail."""

        return self.service.list_transactions(search)

    def assign_asset(self, payload: AssignmentRequest, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Assign an available asset to an active user."""

        return self.service.assign_asset(payload, current_user)

    def transfer_asset(self, payload: TransferRequest, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Transfer an assigned asset to another active user."""

        return self.service.transfer_asset(payload, current_user)


def get_router() -> APIRouter:
    """Create and return the transaction router during application configuration."""

    return TransactionController().router
