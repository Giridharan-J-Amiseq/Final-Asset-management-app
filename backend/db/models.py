"""SQLAlchemy ORM models for WorkSphere.

These models mirror the PostgreSQL schema defined in `database_schema_postgres.sql`.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from constants import CONDITION_NEW, MAINTENANCE_OPEN, STATUS_AVAILABLE


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_name: Mapped[str] = mapped_column(String(100), nullable=False)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    modified_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AssetMaster(Base):
    __tablename__ = "asset_master"

    asset_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asset_name: Mapped[str] = mapped_column(String(150), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    asset_code: Mapped[int | None] = mapped_column(Integer)
    qr_code_value: Mapped[int | None] = mapped_column(Integer)
    qr_code_image_url: Mapped[str | None] = mapped_column(Text)

    model: Mapped[str | None] = mapped_column(String(100))
    brand: Mapped[str | None] = mapped_column(String(100))
    specifications: Mapped[str | None] = mapped_column(Text)

    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    vendor_name: Mapped[str | None] = mapped_column(String(150))
    invoice_number: Mapped[str | None] = mapped_column(String(100))

    warranty_start_date: Mapped[date | None] = mapped_column(Date)
    warranty_expiry: Mapped[int | None] = mapped_column(Integer)

    asset_status: Mapped[str] = mapped_column(String(50), nullable=False, default=STATUS_AVAILABLE)
    condition_status: Mapped[str] = mapped_column(String(50), nullable=False, default=CONDITION_NEW)
    location: Mapped[str | None] = mapped_column(String(150))
    department: Mapped[str | None] = mapped_column(String(150))
    is_retired: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    modified_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    modified_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))


class AssetTransaction(Base):
    __tablename__ = "asset_transaction"

    transaction_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("asset_master.asset_id"), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    from_employee: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    to_assignee: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    action_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    performed_by: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    created_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Maintenance(Base):
    __tablename__ = "maintenance"

    maintenance_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("asset_master.asset_id"), nullable=False)
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    issue_type: Mapped[str] = mapped_column(String(50), nullable=False)
    warranty_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    maintenance_status: Mapped[str] = mapped_column(String(50), nullable=False, default=MAINTENANCE_OPEN)
    vendor: Mapped[str | None] = mapped_column(String(150))
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    created_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    modified_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_log"

    log_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(80), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    performed_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    created_on: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
