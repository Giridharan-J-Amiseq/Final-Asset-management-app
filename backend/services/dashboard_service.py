"""Dashboard summary assembly.

Combines read-only repository queries into a single payload for the frontend.
"""

from typing import Any

from constants import STATUS_ASSIGNED, STATUS_AVAILABLE, STATUS_IN_REPAIR, STATUS_RETIRED
from repositories.dashboard_repository import DashboardRepository


class DashboardService:
    """Builds dashboard summaries from read-only repository queries."""

    def __init__(self, repository: DashboardRepository | None = None):
        """Wire the service to the dashboard repository."""

        self.repository = repository or DashboardRepository()

    def get_dashboard(self) -> dict[str, Any]:
        """Return counts, warranty alerts, recent transactions, and maintenance rows."""

        summary = {
            "total_assets": 0,
            "available": 0,
            "assigned": 0,
            "in_repair": 0,
            "retired": 0,
        }
        for row in self.repository.count_by_status():
            summary["total_assets"] += row["count"]
            status = row["asset_status"]
            if status == STATUS_AVAILABLE:
                summary["available"] = row["count"]
            elif status == STATUS_ASSIGNED:
                summary["assigned"] = row["count"]
            elif status == STATUS_IN_REPAIR:
                summary["in_repair"] = row["count"]
            elif status == STATUS_RETIRED:
                summary["retired"] = row["count"]

        return {
            "counts": summary,
            "warranty_alerts": self.repository.warranty_alerts(),
            "recent_transactions": self.repository.recent_transactions(),
            "recent_maintenance": self.repository.recent_maintenance(),
        }
