/**
 * Simple grid of KPI cards for the dashboard.
 */

/**
 * @param {object} props
 * @param {{label: string, value: import('react').ReactNode, helper?: import('react').ReactNode}[]} props.stats
 */
export function StatsGrid({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-3xl border border-brand-teal/20 bg-gradient-to-br from-white via-white to-ink-50/70 p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-600">{stat.label}</div>
          <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</div>
          {stat.helper && <div className="mt-2 text-sm text-slate-500">{stat.helper}</div>}
        </article>
      ))}
    </div>
  );
}