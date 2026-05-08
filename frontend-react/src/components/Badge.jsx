/**
 * Status badge component.
 *
 * Maps known asset/maintenance statuses to consistent colors.
 */

import clsx from "clsx";

const toneMap = {
  Available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Assigned: "bg-ink-50 text-ink-700 ring-ink-200",
  "In Repair": "bg-amber-50 text-amber-700 ring-amber-200",
  Retired: "bg-slate-100 text-slate-700 ring-slate-200",
  Lost: "bg-rose-50 text-rose-700 ring-rose-200",
  Open: "bg-rose-50 text-rose-700 ring-rose-200",
  "In Progress": "bg-amber-50 text-amber-700 ring-amber-200",
  Closed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/**
 * Badge for status/tones.
 */
export function Badge({ children, tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        toneMap[tone] || "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {children}
    </span>
  );
}