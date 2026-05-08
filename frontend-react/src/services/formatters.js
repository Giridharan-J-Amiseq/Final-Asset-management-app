/**
 * Formatting helpers for consistent UI display.
 */

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.includes(" ") && !trimmed.includes("T") ? trimmed.replace(" ", "T") : trimmed;
    const hasTimezone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(normalized);
    const candidate = hasTimezone ? normalized : `${normalized}Z`;
    const date = new Date(candidate);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  /**
   * Format an ISO date / date-like value into the user's locale.
   * @param {string|number|Date|null|undefined} value
   */
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export function formatDateTime(value) {
  /**
   * Format an ISO date-time / date-like value into the user's locale.
   * @param {string|number|Date|null|undefined} value
   */
  if (!value) return "-";
  const date = parseDateValue(value);
  return date ? date.toLocaleString() : String(value);
}

export function formatCurrency(value) {
  /**
   * Format a numeric value as currency.
   * @param {string|number|null|undefined} value
   */
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
    : String(value);
}

export function formatIssueType(value) {
  /**
   * Normalize issue type strings that may arrive wrapped in braces.
   * @param {string|array|null|undefined} value
   */
  if (!value) return "-";
  if (Array.isArray(value)) return value.join(", ");
  const text = String(value).trim();
  return text.replace(/^\{/, "").replace(/\}$/, "");
}