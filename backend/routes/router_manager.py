"""Central router registration for the WorkSphere API."""

from fastapi import FastAPI

from routes import assets, dashboard, maintenance, transactions, users


class RouterManager:
    """Keeps API router registration in one place for easier project navigation."""

    def __init__(self, app: FastAPI):
        """Receive the FastAPI app that should expose all feature routers."""

        self.app = app

    def register_feature_routers(self) -> None:
        """Attach each feature router to the FastAPI application."""

        for router in (
            assets.get_router(),
            dashboard.get_router(),
            maintenance.get_router(),
            transactions.get_router(),
            users.get_router(),
        ):
            self.app.include_router(router)
