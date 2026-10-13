import { AlertTriangle, ArrowDownRight, ArrowUpRight, Inbox, Minus, Monitor, RefreshCw, Smartphone, Tablet, HelpCircle } from 'lucide-react';
import { useId } from 'react';

export function Card({ title, subtitle, actions, children, className = '', bodyClass = '', as: Tag = 'section', ...rest }) {
  const id = useId();
  return (
    <Tag className={`card ${className}`} aria-labelledby={title ? id : undefined} {...rest}>
      {(title || actions) && (
        <header className="card-head">
          <div className="card-titles">
            {title && <h2 id={id} className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={`card-body ${bodyClass}`}>{children}</div>
    </Tag>
  );
}

export function Skeleton({ height = 16, width = '100%', radius, className = '', style }) {
  return <span className={`skeleton ${className}`} style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 6, height = 18 }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} width={`${92 - ((i * 13) % 35)}%`} />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="skeleton-chart" style={{ height }} role="status" aria-label="Loading chart">
      {Array.from({ length: 14 }, (_, i) => (
        <Skeleton key={i} height={`${30 + ((i * 37) % 60)}%`} width="100%" radius={4} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'No data yet', children, compact = false }) {
  return (
    <div className={`empty ${compact ? 'empty-compact' : ''}`}>
      <span className="empty-icon" aria-hidden="true"><Icon size={compact ? 18 : 22} /></span>
      <p className="empty-title">{title}</p>
      {children && <div className="empty-text">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact = false }) {
  return (
    <div className={`empty error-state ${compact ? 'empty-compact' : ''}`} role="alert">
      <span className="empty-icon" aria-hidden="true"><AlertTriangle size={compact ? 18 : 22} /></span>
      <p className="empty-title">Couldn’t load this data</p>
      <p className="empty-text">{error?.message || 'Unknown error'}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}

/**
 * Renders loading / error / empty / data states for a useApi() result.
 * `isEmpty(data)` decides whether to show the empty state.
 */
export function Async({ q, skeleton, isEmpty, empty, children, compact }) {
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} compact={compact} />;
  if (!q.data) return skeleton ?? <SkeletonRows />;
  if (isEmpty?.(q.data)) return empty ?? <EmptyState compact={compact} title="No data for this period">Try a wider date range or a different device filter.</EmptyState>;
  return children(q.data);
}

/** Accessible segmented control (a group of toggle buttons). */
export function Segmented({ options, value, onChange, label, size = 'md', className = '' }) {
  return (
    <div className={`segmented segmented-${size} ${className}`} role="group" aria-label={label}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={active ? 'is-active' : ''}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            title={o.title}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {o.label && <span className={Icon && o.hideLabel ? 'seg-label-optional' : ''}>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

const DEVICE_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export function DeviceIcon({ device, size = 15 }) {
  const Icon = DEVICE_ICONS[device] || HelpCircle;
  const label = device || 'unknown device';
  return (
    <span className="device-icon" title={label}>
      <Icon size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Inline horizontal bar with a value label (0–max). */
export function MiniBar({ value, max = 100, label, tone = 'accent', width = 90 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="minibar">
      <span className="minibar-track" style={{ width }} aria-hidden="true">
        <span className={`minibar-fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </span>
      {label !== undefined && <span className="minibar-label">{label}</span>}
    </span>
  );
}

/** "+12.3%" with an arrow; `invert` when lower is better. */
export function Delta({ change, invert = false }) {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return <span className="delta delta-none" title="No previous period to compare">—</span>;
  }
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="delta delta-flat">
        <Minus size={12} aria-hidden="true" /> 0%
      </span>
    );
  }
  const up = rounded > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta ${good ? 'delta-good' : 'delta-bad'}`}>
      <Icon size={13} aria-hidden="true" />
      {Math.abs(rounded) >= 1000 ? '999+' : Math.abs(rounded).toFixed(1).replace(/\.0$/, '')}%
      <span className="sr-only">{up ? 'increase' : 'decrease'} vs previous period</span>
    </span>
  );
}

export function PageGroup({ children, title }) {
  return <code className="page-group" title={title || children}>{children}</code>;
}
