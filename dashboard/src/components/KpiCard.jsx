import { Delta, Skeleton } from './ui.jsx';
import { Sparkline } from './charts.jsx';

/** KPI tile: label, big value, % change vs previous period and a sparkline. */
export function KpiCard({ label, value, change, invert = false, spark, color, icon: Icon, loading, hint }) {
  return (
    <article className="kpi" aria-busy={loading || undefined}>
      <div className="kpi-top">
        <h3 className="kpi-label">
          {Icon && <Icon size={14} aria-hidden="true" />}
          {label}
        </h3>
        {!loading && change !== undefined && <Delta change={change} invert={invert} />}
      </div>
      {loading ? (
        <Skeleton height={30} width="60%" className="kpi-skel" />
      ) : (
        <p className="kpi-value">{value}</p>
      )}
      {hint && !loading && <p className="kpi-hint">{hint}</p>}
      {spark && <div className="kpi-spark">{loading ? <Skeleton height={28} /> : <Sparkline values={spark} color={color} height={30} />}</div>}
    </article>
  );
}
