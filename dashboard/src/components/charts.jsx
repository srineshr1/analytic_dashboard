// Shared dark theme bits for recharts.
export const C = {
  accent: '#818cf8',
  accent2: '#a78bfa',
  sky: '#38bdf8',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
  pink: '#f472b6',
  teal: '#2dd4bf',
  grid: 'rgba(148, 163, 184, 0.10)',
  axis: '#7c8599',
};

export const PALETTE = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#60a5fa', '#e879f9'];

export const axisProps = {
  stroke: C.axis,
  tick: { fill: C.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

export const gridProps = { stroke: C.grid, vertical: false };

/** Custom tooltip body for recharts <Tooltip content={...} />. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== null && label !== '' && (
        <div className="chart-tooltip-label">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      )}
      {payload.map((p) => (
        <div key={`${p.dataKey ?? p.name}`} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color || p.payload?.fill || C.accent }} />
          <span className="chart-tooltip-name">{p.name}</span>
          <span className="chart-tooltip-value">{valueFormatter ? valueFormatter(p.value, p) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export const tooltipCursor = { fill: 'rgba(129, 140, 248, 0.08)' };
export const lineCursor = { stroke: 'rgba(148, 163, 184, 0.35)', strokeDasharray: '3 3' };

/** Tiny dependency-free sparkline (SVG). */
export function Sparkline({ values = [], color = C.accent, height = 32, width = 120 }) {
  const id = `sg-${color.replace('#', '')}`;
  if (values.length < 2) return <svg className="sparkline" width={width} height={height} aria-hidden="true" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
