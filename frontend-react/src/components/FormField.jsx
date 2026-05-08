/**
 * Form input primitives with consistent Tailwind styling.
 */

import { ChevronDown } from "lucide-react";

/**
 * Text input field.
 */
export function InputField({ label, className = "", labelClassName = "", required, ...props }) {
  return (
    <label className="block min-w-0 space-y-2">
      {label && (
        <span className={`text-sm font-medium text-slate-700 ${labelClassName}`}>
          {label}{required ? <span className="text-rose-500"> *</span> : null}
        </span>
      )}
      <input
        className={`min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-ink-200 focus:border-brand-teal focus:ring-4 focus:ring-ink-100 ${className}`}
        required={required}
        {...props}
      />
    </label>
  );
}

/**
 * Select (dropdown) field.
 */
export function SelectField({ label, children, className = "", labelClassName = "", required, ...props }) {
  const isControlled = Object.prototype.hasOwnProperty.call(props, "value");
  const isEmpty = isControlled && (props.value === "" || props.value === null || props.value === undefined);

  return (
    <label className="block min-w-0 space-y-2">
      {label && (
        <span className={`text-sm font-medium text-slate-700 ${labelClassName}`}>
          {label}{required ? <span className="text-rose-500"> *</span> : null}
        </span>
      )}
      <div className="relative">
        <select
          className={`min-h-12 w-full min-w-0 appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition hover:border-ink-200 focus:border-brand-teal focus:ring-4 focus:ring-ink-100 ${
            isEmpty ? "text-slate-500" : "text-slate-900"
          } ${className}`}
          required={required}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </div>
    </label>
  );
}

/**
 * Multi-line textarea field.
 */
export function TextareaField({ label, className = "", labelClassName = "", required, ...props }) {
  return (
    <label className="block min-w-0 space-y-2">
      {label && (
        <span className={`text-sm font-medium text-slate-700 ${labelClassName}`}>
          {label}{required ? <span className="text-rose-500"> *</span> : null}
        </span>
      )}
      <textarea
        className={`min-h-28 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-ink-200 focus:border-brand-teal focus:ring-4 focus:ring-ink-100 ${className}`}
        required={required}
        {...props}
      />
    </label>
  );
}
