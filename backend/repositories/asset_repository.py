"""Asset persistence (repository layer).

Repositories are responsible for data access only (no HTTP concerns).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import String, and_, case, cast, delete, func, or_, select, text
from sqlalchemy.orm import aliased

from constants import STATUS_ASSIGNED, STATUS_AVAILABLE, STATUS_RETIRED
from db.models import ActivityLog, AssetMaster, AssetTransaction, Maintenance, User
from db.serialization import model_to_dict
from db.session import session_scope


class AssetRepository:
    """Provides persistence operations for asset records."""

    def ensure_asset_code_column(self) -> None:
        """Deprecated: schema changes should be handled via migrations/schema files."""

        return

    def find_assets_missing_codes(self) -> list[dict[str, Any]]:
        """Return assets that need numeric asset codes."""

        with session_scope() as session:
            rows = session.execute(select(AssetMaster.asset_id, AssetMaster.asset_code)).all()
            payload: list[dict[str, Any]] = []
            for asset_id, asset_code in rows:
                if asset_code is None:
                    payload.append({"asset_id": str(asset_id)})
            return payload

    def next_asset_code(self) -> int:
        """Return the next numeric asset code from the database sequence."""

        with session_scope() as session:
            value = session.execute(text("SELECT nextval('asset_code_seq')")).scalar_one()
            return int(value)

    def update_asset_code(self, asset_id: str, asset_code: int) -> None:
        """Persist a generated asset code for a single asset."""

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id)
            if asset:
                asset.asset_code = asset_code

    def find_by_id(self, asset_id: str) -> dict[str, Any] | None:
        """Return one asset by primary key."""

        asset_id_value = str(asset_id).strip() if asset_id is not None else ""
        if not asset_id_value:
            return None

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id_value)
            return model_to_dict(asset) if asset else None

    def find_by_asset_code(self, asset_code: int) -> dict[str, Any] | None:
        """Return one asset by its numeric asset code."""

        try:
            asset_code_value = int(asset_code)
        except (TypeError, ValueError):
            return None

        with session_scope() as session:
            asset = (
                session.execute(select(AssetMaster).where(AssetMaster.asset_code == asset_code_value).limit(1))
                .scalar_one_or_none()
            )
            return model_to_dict(asset) if asset else None

    def find_by_serial(self, serial_number: str, exclude_asset_id: str | None = None) -> dict[str, Any] | None:
        """Return an asset with the same serial number, optionally excluding one asset."""

        with session_scope() as session:
            stmt = select(AssetMaster.asset_id).where(AssetMaster.serial_number == serial_number)
            if exclude_asset_id is not None:
                stmt = stmt.where(AssetMaster.asset_id != exclude_asset_id)
            row = session.execute(stmt.limit(1)).first()
            return {"asset_id": row[0]} if row else None

    def count_assets(
        self,
        search: str | None = None,
        status_filter: str | None = None,
        type_filter: str | None = None,
        location: str | None = None,
        department: str | None = None,
    ) -> int:
        """Count assets after applying optional filters.

        By default, retired assets are hidden. If status_filter is Retired, only
        retired assets are counted.
        """

        with session_scope() as session:
            where_clauses = self._build_asset_filters(search, status_filter, type_filter, location, department)
            stmt = select(func.count()).select_from(AssetMaster).where(and_(*where_clauses))
            return int(session.execute(stmt).scalar_one())

    def list_assets(
        self,
        page: int,
        page_size: int,
        search: str | None = None,
        status_filter: str | None = None,
        type_filter: str | None = None,
        location: str | None = None,
        department: str | None = None,
    ) -> list[dict[str, Any]]:
        """Return paginated assets after applying optional filters.

        By default, retired assets are hidden. If status_filter is Retired, only
        retired assets are returned.
        """

        with session_scope() as session:
            where_clauses = self._build_asset_filters(search, status_filter, type_filter, location, department)
            offset = (page - 1) * page_size
            current_assignee_name = self._current_assignee_name_subquery().label("current_assignee_name")
            current_assignee_id = self._current_assignee_id_subquery().label("current_assignee_id")
            rows = (
                session.execute(
                    select(AssetMaster, current_assignee_name, current_assignee_id)
                    .where(and_(*where_clauses))
                    .order_by(AssetMaster.modified_on.desc(), AssetMaster.created_on.desc())
                    .limit(page_size)
                    .offset(offset)
                )
                .all()
            )
            payload: list[dict[str, Any]] = []
            for asset, assignee_name, assignee_id in rows:
                item = model_to_dict(asset)
                item["current_assignee_name"] = assignee_name
                item["current_assignee_id"] = assignee_id
                payload.append(item)
            return payload

    def _latest_assignee_id_subquery(self):
        return (
            select(AssetTransaction.to_assignee)
            .where(AssetTransaction.asset_id == AssetMaster.asset_id)
            .order_by(AssetTransaction.action_date.desc(), AssetTransaction.transaction_id.desc())
            .limit(1)
            .correlate(AssetMaster)
            .scalar_subquery()
        )

    def _latest_assignee_name_subquery(self):
        return (
            select(User.user_name)
            .select_from(AssetTransaction)
            .join(User, User.user_id == AssetTransaction.to_assignee)
            .where(AssetTransaction.asset_id == AssetMaster.asset_id)
            .order_by(AssetTransaction.action_date.desc(), AssetTransaction.transaction_id.desc())
            .limit(1)
            .correlate(AssetMaster)
            .scalar_subquery()
        )

    def _current_assignee_name_subquery(self):
        return case(
            (AssetMaster.asset_status == STATUS_ASSIGNED, self._latest_assignee_name_subquery()),
            else_=None,
        )

    def _current_assignee_id_subquery(self):
        return case(
            (AssetMaster.asset_status == STATUS_ASSIGNED, self._latest_assignee_id_subquery()),
            else_=None,
        )

    def _build_asset_filters(
        self,
        search: str | None,
        status_filter: str | None,
        type_filter: str | None,
        location: str | None,
        department: str | None,
    ) -> list[Any]:
        # Default behavior hides retired assets in active inventory.
        # When explicitly filtering for Retired, include only retired rows.
        filters: list[Any] = [AssetMaster.is_retired.is_(True)] if status_filter == STATUS_RETIRED else [AssetMaster.is_retired.is_(False)]

        if search:
            search_value = f"%{search}%"
            current_assignee_name = self._current_assignee_name_subquery()

            filters.append(
                or_(
                    AssetMaster.asset_name.ilike(search_value),
                    AssetMaster.serial_number.ilike(search_value),
                    AssetMaster.brand.ilike(search_value),
                    cast(AssetMaster.asset_code, String).ilike(search_value),
                    AssetMaster.asset_id.ilike(search_value),
                    current_assignee_name.ilike(search_value),
                )
            )
        if status_filter:
            filters.append(AssetMaster.asset_status == status_filter)
        if type_filter:
            filters.append(AssetMaster.asset_type == type_filter)
        if location:
            filters.append(AssetMaster.location == location)
        if department:
            filters.append(AssetMaster.department == department)
        return filters

    def create_asset(self, payload, asset_id: str, asset_code: int, current_user_id: int) -> str:
        """Insert a new asset row and return the generated asset id."""

        with session_scope() as session:
            asset = AssetMaster(
                asset_id=asset_id,
                asset_name=payload.asset_name,
                asset_type=payload.asset_type,
                category=payload.category,
                serial_number=payload.serial_number,
                asset_code=asset_code,
                qr_code_value=None,
                model=payload.model,
                brand=payload.brand,
                specifications=payload.specifications,
                purchase_date=payload.purchase_date,
                purchase_cost=payload.purchase_cost,
                vendor_name=payload.vendor_name,
                invoice_number=payload.invoice_number,
                warranty_start_date=payload.warranty_start_date,
                warranty_expiry=payload.warranty_expiry,
                asset_status=payload.asset_status,
                condition_status=payload.condition_status,
                location=payload.location,
                department=payload.department,
                is_retired=False,
                created_by=current_user_id,
                modified_by=current_user_id,
            )
            session.add(asset)
            session.flush()
            return str(asset.asset_id)

    def update_asset_fields(self, asset_id: str, data: dict[str, Any], modified_by: int) -> None:
        """Update selected asset fields without changing unspecified columns."""

        allowed_fields = {
            "asset_name",
            "asset_type",
            "category",
            "serial_number",
            "model",
            "brand",
            "specifications",
            "purchase_date",
            "purchase_cost",
            "vendor_name",
            "invoice_number",
            "warranty_start_date",
            "warranty_expiry",
            "asset_status",
            "condition_status",
            "location",
            "department",
            "asset_code",
        }
        filtered = {key: value for key, value in data.items() if key in allowed_fields}
        if not filtered:
            return

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id)
            if not asset:
                return
            for key, value in filtered.items():
                setattr(asset, key, value)
            asset.modified_by = modified_by

    def retire_asset(self, asset_id: str, modified_by: int) -> None:
        """Soft-retire an asset and move it to the Retired status."""

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id)
            if asset:
                asset.is_retired = True
                asset.asset_status = STATUS_RETIRED
                asset.modified_by = modified_by

    def delete_asset_hard(self, asset_id: str) -> bool:
        """Delete an asset and all related records."""

        asset_id_value = str(asset_id).strip() if asset_id is not None else ""
        if not asset_id_value:
            return False

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id_value)
            if not asset:
                return False

            session.execute(delete(AssetTransaction).where(AssetTransaction.asset_id == asset_id_value))
            session.execute(delete(Maintenance).where(Maintenance.asset_id == asset_id_value))
            session.execute(text("DELETE FROM alerts WHERE asset_id = :asset_id"), {"asset_id": asset_id_value})
            session.execute(
                delete(ActivityLog).where(
                    ActivityLog.entity_type == "asset",
                    ActivityLog.entity_id == asset_id_value,
                )
            )
            session.delete(asset)
            return True

    def update_qr(self, asset_id: str, qr_value: int, image_url: str) -> None:
        """Store QR metadata after a QR image has been generated."""

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id)
            if asset:
                asset.qr_code_value = qr_value
                asset.qr_code_image_url = image_url

    def mark_available(self, asset_id: str, modified_by: int) -> dict[str, Any] | None:
        """Set an asset status to Available and return the updated asset row."""

        with session_scope() as session:
            asset = session.get(AssetMaster, asset_id)
            if not asset:
                return None
            asset.asset_status = STATUS_AVAILABLE
            asset.modified_by = modified_by
            session.flush()
            return model_to_dict(asset)

    def list_transactions_for_asset(self, asset_id: str) -> list[dict[str, Any]]:
        """Return the movement history for one asset."""

        with session_scope() as session:
            # Use correlated scalar subqueries to keep the payload shape stable.
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
            performed_name = (
                select(User.user_name)
                .where(User.user_id == AssetTransaction.performed_by)
                .correlate(AssetTransaction)
                .scalar_subquery()
            )

            rows = session.execute(
                select(
                    AssetTransaction,
                    from_name.label("from_employee_name"),
                    to_name.label("to_assignee_name"),
                    performed_name.label("performed_by_name"),
                )
                .where(AssetTransaction.asset_id == asset_id)
                .order_by(AssetTransaction.action_date.desc())
            ).all()

            payload: list[dict[str, Any]] = []
            for tx, from_employee_name, to_assignee_name, performed_by_name in rows:
                item = model_to_dict(tx)
                item["from_employee_name"] = from_employee_name
                item["to_assignee_name"] = to_assignee_name
                item["performed_by_name"] = performed_by_name
                payload.append(item)
            return payload

    def list_maintenance_for_asset(self, asset_id: str) -> list[dict[str, Any]]:
        """Return maintenance records linked to one asset."""

        with session_scope() as session:
            rows = (
                session.execute(
                    select(Maintenance)
                    .where(Maintenance.asset_id == asset_id)
                    .order_by(Maintenance.created_on.desc())
                )
                .scalars()
                .all()
            )
            return [model_to_dict(row) for row in rows]

    def list_assets_assigned_to_user(self, user_id: int) -> list[dict[str, Any]]:
        """Return assets where the latest transaction assigns them to the user."""

        with session_scope() as session:
            ranked_transactions = (
                select(
                    AssetTransaction.transaction_id,
                    AssetTransaction.asset_id,
                    AssetTransaction.to_assignee,
                    AssetTransaction.from_employee,
                    AssetTransaction.performed_by,
                    AssetTransaction.action_date,
                    AssetTransaction.transaction_type,
                    AssetTransaction.remarks,
                    func.row_number()
                    .over(
                        partition_by=AssetTransaction.asset_id,
                        order_by=(AssetTransaction.action_date.desc(), AssetTransaction.transaction_id.desc()),
                    )
                    .label("rn"),
                )
                .subquery()
            )

            from_user = aliased(User)
            performed_user = aliased(User)

            rows = session.execute(
                select(
                    AssetMaster,
                    ranked_transactions.c.action_date.label("assigned_on"),
                    ranked_transactions.c.transaction_type.label("assignment_type"),
                    ranked_transactions.c.remarks.label("remarks"),
                    from_user.user_name.label("from_employee_name"),
                    performed_user.user_name.label("performed_by_name"),
                )
                .join(ranked_transactions, ranked_transactions.c.asset_id == AssetMaster.asset_id)
                .outerjoin(from_user, from_user.user_id == ranked_transactions.c.from_employee)
                .outerjoin(performed_user, performed_user.user_id == ranked_transactions.c.performed_by)
                .where(
                    AssetMaster.is_retired.is_(False),
                    AssetMaster.asset_status == STATUS_ASSIGNED,
                    ranked_transactions.c.rn == 1,
                    ranked_transactions.c.to_assignee == user_id,
                )
                .order_by(ranked_transactions.c.action_date.desc(), AssetMaster.asset_name.asc())
            ).all()

            payload: list[dict[str, Any]] = []
            for asset, assigned_on, assignment_type, remarks, from_employee_name, performed_by_name in rows:
                item = model_to_dict(asset)
                item["assigned_on"] = assigned_on
                item["assignment_type"] = assignment_type
                item["remarks"] = remarks
                item["from_employee_name"] = from_employee_name
                item["performed_by_name"] = performed_by_name
                payload.append(item)
            return payload

    def return_assets_from_user(self, user_id: int, modified_by: int) -> list[str]:
        """Mark assets as Available when they are currently assigned to the given user.

        This updates asset_master.asset_status; it does not create a new transaction row
        because the transaction schema currently requires a non-null assignee.
        """

        with session_scope() as session:
            ranked_transactions = (
                select(
                    AssetTransaction.asset_id,
                    AssetTransaction.to_assignee,
                    func.row_number()
                    .over(
                        partition_by=AssetTransaction.asset_id,
                        order_by=(AssetTransaction.action_date.desc(), AssetTransaction.transaction_id.desc()),
                    )
                    .label("rn"),
                )
                .subquery()
            )

            asset_ids = [
                row[0]
                for row in session.execute(
                    select(AssetMaster.asset_id)
                    .join(ranked_transactions, ranked_transactions.c.asset_id == AssetMaster.asset_id)
                    .where(
                        AssetMaster.is_retired.is_(False),
                        AssetMaster.asset_status == STATUS_ASSIGNED,
                        ranked_transactions.c.rn == 1,
                        ranked_transactions.c.to_assignee == user_id,
                    )
                ).all()
            ]

            updated_ids: list[str] = []
            for asset_id in asset_ids:
                asset = session.get(AssetMaster, asset_id)
                if not asset:
                    continue
                asset.asset_status = STATUS_AVAILABLE
                asset.modified_by = modified_by
                updated_ids.append(str(asset_id))

            return updated_ids
