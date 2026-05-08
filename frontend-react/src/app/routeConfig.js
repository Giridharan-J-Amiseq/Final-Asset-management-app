/**
 * Frontend navigation + shared dropdown values.
 *
 * This file centralizes the role-to-route mapping so the UI stays consistent
 * with backend authorization rules.
 */

export const navigationItems = [
  { path: "/dashboard", label: "Dashboard", roles: ["Admin"] },
  { path: "/assets", label: "Manage Asset", roles: ["Admin", "Viewer"] },
  { path: "/transactions", label: "Asset Transaction", roles: ["Admin"] },
  { path: "/assign", label: "Assign Asset", roles: ["Admin"] },
  { path: "/transfer", label: "Transfer Asset", roles: ["Admin"] },
  { path: "/maintenance", label: "Maintenance", roles: ["Admin"] },
  { path: "/users", label: "Users", roles: ["Admin"] },
  { path: "/qr-print", label: "QR Print", roles: ["Admin"] },
];

export const assetTypes = ["Laptop", "Desktop", "Server", "Furniture", "Printer", "Phone", "Monitor", "UPS", "Other"];
export const assetStatuses = ["Available", "Assigned", "In Repair", "Retired", "Lost"];
export const assetConditions = ["New", "Good", "Damaged"];
export const maintenanceIssueTypes = ["Repair", "Physical Damage", "Theft", "Software Issue"];
export const userRoles = ["Admin", "Viewer"];
