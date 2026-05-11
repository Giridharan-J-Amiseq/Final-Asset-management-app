"""Shared constants used across the WorkSphere backend.

Keeping business labels in one place prevents route, service, and schema files
from drifting apart when a role, status, or dropdown value changes.
"""

ADMIN_ROLE = "Admin"
VIEWER_ROLE = "Viewer"

EDITOR_ROLES = (ADMIN_ROLE,)
ALL_ROLES = (ADMIN_ROLE, VIEWER_ROLE)

ASSET_TYPES = ("Laptop", "Desktop", "Server", "Furniture", "Printer", "Phone", "Monitor", "UPS", "Other")
ASSET_CATEGORIES = ("IT", "Non-IT")

STATUS_AVAILABLE = "Available"
STATUS_ASSIGNED = "Assigned"
STATUS_IN_REPAIR = "In Repair"
STATUS_RETIRED = "Retired"
STATUS_LOST = "Lost"
ASSET_STATUSES = (STATUS_AVAILABLE, STATUS_ASSIGNED, STATUS_IN_REPAIR, STATUS_RETIRED, STATUS_LOST)

CONDITION_NEW = "New"
CONDITION_GOOD = "Good"
CONDITION_DAMAGED = "Damaged"
CONDITION_STATUSES = (CONDITION_NEW, CONDITION_GOOD, CONDITION_DAMAGED)

TRANSACTION_NEW_ASSET = "New Asset"
TRANSACTION_TRANSFER = "Asset Transfer"
TRANSACTION_TYPES = (TRANSACTION_NEW_ASSET, TRANSACTION_TRANSFER)

ISSUE_REPAIR = "Repair"
ISSUE_PHYSICAL_DAMAGE = "Physical Damage"
ISSUE_THEFT = "Theft"
ISSUE_SOFTWARE = "Software Issue"
ISSUE_WARRANTY_EXTENSION = "Extend Warranty"
MAINTENANCE_ISSUE_TYPES = (ISSUE_REPAIR, ISSUE_PHYSICAL_DAMAGE, ISSUE_THEFT, ISSUE_SOFTWARE, ISSUE_WARRANTY_EXTENSION)

MAINTENANCE_OPEN = "Open"
MAINTENANCE_IN_PROGRESS = "In Progress"
MAINTENANCE_CLOSED = "Closed"
MAINTENANCE_STATUSES = (MAINTENANCE_OPEN, MAINTENANCE_IN_PROGRESS, MAINTENANCE_CLOSED)

ASSET_LOCATIONS = {
    "Chennai": "CHN",
    "Pune": "PUN",
}
ASSET_DEPARTMENTS = {
    "IA": "Intelligent Automation",
    "Client": "Client",
    "Cyber Security": "Cyber Security",
    "IT Administration": "IT Administration",
}

ASSET_CODE_PREFIX = "AMQ"
DEFAULT_LOCAL_QR_PREFIX = "/static/qrcodes"

ROOT_PATH = "/"
LOGIN_PATH = "/auth/login"
STATIC_PATH = "/static"
FRONTEND_APP_PATH = "/app"

DASHBOARD_PREFIX = "/dashboard"
ASSETS_PREFIX = "/assets"
TRANSACTIONS_PREFIX = "/transactions"
MAINTENANCE_PREFIX = "/maintenance"
USERS_PREFIX = "/users"
