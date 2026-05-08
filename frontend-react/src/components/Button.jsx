/**
 * Shared button component.
 *
 * `variant` controls visual treatment; `as` allows rendering as a different
 * element (e.g. react-router Link).
 */

import clsx from "clsx";

/**
 * Button with consistent styling and variants.
 */
export function Button({ as: Component = "button", className, variant = "primary", ...props }) {
  const variants = {
    primary: "bg-gradient-to-r from-brand-green to-brand-teal text-white hover:opacity-95",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-ink-50/50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };

  return (
    <Component
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold leading-5 transition focus:outline-none focus:ring-2 focus:ring-ink-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
