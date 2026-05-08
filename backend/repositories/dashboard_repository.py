"""Dashboard read-only queries (repository layer)."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import func, select

from db.models import AssetMaster, AssetTransaction, Maintenance, User
from db.session import session_scope


class DashboardRepository:
    """Provides read-only dashboard queries."""

    def count_by_status(self) -> list[dict[str, Any]]:
        """Return grouped asset counts by status."""

        with session_scope() as session:
            rows = session.execute(
                select(AssetMaster.asset_status, func.count().label("count")).group_by(AssetMaster.asset_status)
            ).all()
            return [{"asset_status": asset_status, "count": int(count)} for asset_status, count in rows]

    def warranty_alerts(self) -> list[dict[str, Any]]:
        """Return assets whose warranty expires in the next 30 days."""

        def add_years(start: date, years: int) -> date:
            try:
                return start.replace(year=start.year + years)
            except ValueError:
                # Handle February 29 for non-leap target years.
                return start.replace(year=start.year + years, day=28)

        today = date.today()
        alerts: list[dict[str, Any]] = []
        with session_scope() as session:
            rows = session.execute(
                select(
                    AssetMaster.asset_id,
                    AssetMaster.asset_name,
                    AssetMaster.serial_number,
                    AssetMaster.warranty_start_date,
                    AssetMaster.warranty_expiry,
                ).where(
                    AssetMaster.is_retired.is_(False),
                    AssetMaster.warranty_start_date.is_not(None),
                    AssetMaster.warranty_expiry.is_not(None),
                )
            ).all()

            for asset_id, asset_name, serial_number, warranty_start_date, warranty_expiry in rows:
                if not warranty_start_date or warranty_expiry is None:
                    continue
                warranty_end_date = add_years(warranty_start_date, int(warranty_expiry))
                days_left = (warranty_end_date - today).days
                if 0 <= days_left <= 30:
                    alerts.append(
                        {
                            "asset_id": asset_id,
                            "asset_name": asset_name,
                            "serial_number": serial_number,
                            "warranty_start_date": warranty_start_date,
                            "warranty_expiry": int(warranty_expiry),
                            "warranty_end_date": warranty_end_date,
                        }
                    )

        alerts.sort(key=lambda item: item.get("warranty_end_date") or today)
        return alerts

    def recent_transactions(self) -> list[dict[str, Any]]:
        """Return the five latest asset transactions for dashboard display."""

        with session_scope() as session:
            from_name = (
                select(User.user_name)
                .where(User.user_id == AssetTransaction.from_employee)
                .correlate(AssetTransaction)
                .scalar_subquery()
            )
            to_name = (
                select(User.user_name)
                .where(User.user_id == AssetTransaction.to_assignee)
                .correlate(AssetTransaction)
                .scalar_subquery()
            )

            rows = session.execute(
                select(
                    AssetTransaction.transaction_id,
                    AssetTransaction.transaction_type,
                    AssetTransaction.action_date,
                    AssetMaster.asset_name,
                    from_name.label("from_employee_name"),
                    to_name.label("to_assignee_name"),
                )
                .join(AssetMaster, AssetMaster.asset_id == AssetTransaction.asset_id)
                .order_by(AssetTransaction.action_date.desc())
                .limit(5)
            ).all()

            return [
                {
                    "transaction_id": transaction_id,
                    "transaction_type": transaction_type,
                    "action_date": action_date,
                    "asset_name": asset_name,
                    "from_employee_name": from_employee_name,
                    "to_assignee_name": to_assignee_name,
                }
                for transaction_id, transaction_type, action_date, asset_name, from_employee_name, to_assignee_name in rows
            ]

    def recent_maintenance(self) -> list[dict[str, Any]]:
        """Return the five latest maintenance records for dashboard display."""

        with session_scope() as session:
            rows = session.execute(
                select(
                    Maintenance.maintenance_id,
                    Maintenance.issue_type,
                    Maintenance.maintenance_status,
                    Maintenance.created_on,
                    AssetMaster.asset_name,
                )
                .join(AssetMaster, AssetMaster.asset_id == Maintenance.asset_id)
                .order_by(Maintenance.created_on.desc())
                .limit(5)
            ).all()

            return [
                {
                    "maintenance_id": maintenance_id,
                    "issue_type": issue_type,
                    "maintenance_status": maintenance_status,
                    "created_on": created_on,
                    "asset_name": asset_name,
                }
                for maintenance_id, issue_type, maintenance_status, created_on, asset_name in rows
            ]
