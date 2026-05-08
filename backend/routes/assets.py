"""Asset endpoints.

Defines CRUD-like routes and helpers for listing, updating, retiring assets,
and generating QR codes.
"""

from fastapi import APIRouter, Depends, Query, status

from auth import CurrentUser, require_roles
from constants import ADMIN_ROLE, ASSETS_PREFIX, EDITOR_ROLES
from schemas import ApiMessage, AssetCreate, AssetUpdate, Pager
from services.asset_service import AssetService


class AssetController:
    """Registers asset API endpoints and delegates business work to AssetService."""

    def __init__(self, service: AssetService | None = None):
        """Create the APIRouter and bind endpoint methods."""

        self.service = service or AssetService()
        self.router = APIRouter(prefix=ASSETS_PREFIX, tags=["Assets"])
        self.register_routes()

    def register_routes(self) -> None:
        """Attach asset endpoint methods to the router."""

        self.router.add_api_route("/meta/dropdowns", self.get_dropdowns, methods=["GET"])
        self.router.add_api_route("", self.list_assets, methods=["GET"], response_model=Pager)
        self.router.add_api_route("/{asset_id}", self.get_asset, methods=["GET"])
        self.router.add_api_route("", self.create_asset, methods=["POST"], status_code=status.HTTP_201_CREATED)
        self.router.add_api_route("/{asset_id}", self.update_asset, methods=["PUT"])
        self.router.add_api_route("/{asset_id}/available", self.mark_available, methods=["PATCH"], response_model=ApiMessage)
        self.router.add_api_route("/{asset_id}/retire", self.retire_asset, methods=["PATCH"], response_model=ApiMessage)
        self.router.add_api_route("/{asset_id}/qr", self.generate_qr, methods=["POST"])

    def get_dropdowns(self, _: CurrentUser):
        """Return select-list values used by the asset form."""

        return self.service.dropdown_options()

    def list_assets(
        self,
        _: CurrentUser,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=10, ge=1, le=100),
        search: str | None = None,
        status_filter: str | None = None,
        type_filter: str | None = None,
        location: str | None = None,
        department: str | None = None,
    ):
        """Return a filtered and paginated list of active assets."""

        return self.service.list_assets(page, page_size, search, status_filter, type_filter, location, department)

    def get_asset(self, asset_id: str, _: CurrentUser):
        """Return asset details with transaction and maintenance history."""

        return self.service.get_asset_detail(asset_id)

    def create_asset(self, payload: AssetCreate, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Create an asset, its asset code, and its QR code."""

        return self.service.create_asset(payload, current_user)

    def update_asset(self, asset_id: str, payload: AssetUpdate, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Update editable asset fields."""

        return self.service.update_asset(asset_id, payload, current_user)

    def mark_available(self, asset_id: str, current_user: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Return an asset to Available status."""

        return self.service.mark_available(asset_id, current_user)

    def retire_asset(self, asset_id: str, current_user: dict = Depends(require_roles(ADMIN_ROLE))):
        """Retire an asset so it no longer appears in the active inventory."""

        return self.service.retire_asset(asset_id, current_user)

    def generate_qr(self, asset_id: str, _: dict = Depends(require_roles(*EDITOR_ROLES))):
        """Generate or refresh an asset QR image."""

        return self.service.generate_qr(asset_id)


def get_router() -> APIRouter:
    """Create and return the asset router during application configuration."""

    return AssetController().router
