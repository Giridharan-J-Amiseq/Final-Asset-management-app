"""Dashboard endpoints.

Provides high-level operational summaries used by the React dashboard.
"""

from fastapi import APIRouter

from auth import CurrentUser
from constants import DASHBOARD_PREFIX
from services.dashboard_service import DashboardService


class DashboardController:
    """Registers dashboard endpoints for high-level operational summaries."""

    def __init__(self, service: DashboardService | None = None):
        """Create the APIRouter and bind endpoint methods."""

        self.service = service or DashboardService()
        self.router = APIRouter(prefix=DASHBOARD_PREFIX, tags=["Dashboard"])
        self.register_routes()

    def register_routes(self) -> None:
        """Attach dashboard endpoint methods to the router."""

        self.router.add_api_route("", self.get_dashboard, methods=["GET"])

    def get_dashboard(self, _: CurrentUser):
        """Return the dashboard summary payload used by the React dashboard page."""

        return self.service.get_dashboard()


def get_router() -> APIRouter:
    """Create and return the dashboard router during application configuration."""

    return DashboardController().router
