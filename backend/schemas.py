"""Pydantic request/response models for the WorkSphere API.

These schemas define the API contract and validate inputs before they reach the
database/repository layer.
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from constants import CONDITION_NEW, STATUS_AVAILABLE

# API-safe literal values. The shared constants file contains the runtime values
# used by routes/services; these aliases keep Pydantic validation explicit.
RoleType = Literal["Admin", "Viewer"]
AssetType = Literal["Laptop", "Desktop", "Server", "Furniture", "Printer", "Phone", "Monitor", "UPS", "Other"]
CategoryType = Literal["IT", "Non-IT"]
AssetStatus = Literal["Available", "Assigned", "In Repair", "Retired", "Lost"]
ConditionStatus = Literal["New", "Good", "Damaged"]
TransactionType = Literal["New Asset", "Asset Transfer"]
IssueType = Literal["Repair", "Physical Damage", "Theft", "Software Issue"]
MaintenanceStatus = Literal["Open", "In Progress", "Closed"]


class TokenResponse(BaseModel):
    """Response returned after a successful login."""

    access_token: str
    token_type: str = "bearer"
    user: dict


class LoginRequest(BaseModel):
    """Request body used by the login endpoint."""

    username: str
    password: str


class UserBase(BaseModel):
    """Shared user fields used by create and update schemas."""

    user_name: str = Field(..., max_length=100)
    username: str = Field(..., max_length=50)
    email: EmailStr
    role: RoleType
    is_active: bool = True


class UserCreate(UserBase):
    """Request body for creating a user account."""

    password: str = Field(..., min_length=4, max_length=100)


class UserUpdate(BaseModel):
    """Request body for partial user updates."""

    user_name: str | None = None
    username: str | None = None
    email: EmailStr | None = None
    role: RoleType | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=4, max_length=100)


class AssetBase(BaseModel):
    """Shared asset fields and validation rules for asset create/update workflows."""

    asset_name: str
    asset_type: AssetType
    category: CategoryType
    serial_number: str
    model: str | None = None
    brand: str | None = None
    specifications: str | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    vendor_name: str | None = None
    invoice_number: str | None = None
    warranty_start_date: date | None = None
    warranty_expiry: int | None = Field(default=None, ge=0, le=50)
    asset_status: AssetStatus = STATUS_AVAILABLE
    condition_status: ConditionStatus = CONDITION_NEW
    location: str | None = None
    department: str | None = None

    @field_validator("purchase_date", "warranty_start_date")
    @classmethod
    def dates_cannot_be_in_the_future(cls, value: date | None) -> date | None:
        """Reject future purchase or warranty start dates before data reaches the database."""

        if value and value > date.today():
            raise ValueError("Date cannot be in the future")
        return value


class AssetCreate(AssetBase):
    """Request body for registering a new asset."""

    pass


class AssetUpdate(BaseModel):
    """Request body for partial asset updates."""

    asset_name: str | None = None
    asset_type: AssetType | None = None
    category: CategoryType | None = None
    serial_number: str | None = None
    model: str | None = None
    brand: str | None = None
    specifications: str | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    vendor_name: str | None = None
    invoice_number: str | None = None
    warranty_start_date: date | None = None
    warranty_expiry: int | None = Field(default=None, ge=0, le=50)
    asset_status: AssetStatus | None = None
    condition_status: ConditionStatus | None = None
    location: str | None = None
    department: str | None = None

    @field_validator("purchase_date", "warranty_start_date")
    @classmethod
    def dates_cannot_be_in_the_future(cls, value: date | None) -> date | None:
        """Reject future purchase or warranty start dates before data reaches the database."""

        if value and value > date.today():
            raise ValueError("Date cannot be in the future")
        return value


class AssignmentRequest(BaseModel):
    """Request body for assigning an available asset to a user."""

    asset_id: int
    to_assignee: int
    remarks: str | None = None


class TransferRequest(BaseModel):
    """Request body for transferring an assigned asset to another user."""

    asset_id: int
    to_assignee: int
    remarks: str | None = None


class MaintenanceCreate(BaseModel):
    """Request body for logging a new maintenance issue."""

    asset_id: int
    issue_description: str
    issue_type: IssueType
    warranty_applicable: bool = False
    vendor: str | None = None
    resolution_notes: str | None = None


class MaintenanceUpdate(BaseModel):
    """Request body for partial maintenance record updates."""

    issue_description: str | None = None
    issue_type: IssueType | None = None
    warranty_applicable: bool | None = None
    maintenance_status: MaintenanceStatus | None = None
    vendor: str | None = None
    resolution_notes: str | None = None


class ApiMessage(BaseModel):
    """Generic response for endpoints that only need a status message."""

    message: str


class Pager(BaseModel):
    """Standard paginated response shape used by list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    page: int
    page_size: int
    total: int
    items: list[dict]


class DashboardResponse(BaseModel):
    """Response shape used by the dashboard summary endpoint."""

    counts: dict
    warranty_alerts: list[dict]
    recent_transactions: list[dict]
    recent_maintenance: list[dict]
