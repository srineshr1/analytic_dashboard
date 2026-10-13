import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, CircleDollarSign, Eye, Flame, Percent, ShoppingBag, Timer, TrendingDown, Users } from 'lucide-react';
import { Async, Card, EmptyState, MiniBar, PageGroup, SkeletonChart } from '../components/ui.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { ChartTooltip, C, PALETTE, axisProps, gridProps, lineCursor, tooltipCursor } from '../components/charts.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { useApi } from '../lib/useApi.js';
import { bucketLabel, bucketTick, useQueryFilters } from '../lib/hooks.js';
import { useFilterHref } from '../lib/filters.jsx';
import { fmtCompact, fmtCurrency, fmtDuration, fmtNum, fmtPct, pctChange } from '../lib/format.js';

const safeDiv = (a, b) => (b ? a / b : 0);

const KPIS = [
  { key: 'sessions', label: 'Sessions', icon: Users, fmt: fmtCompact, color: C.accent, spark: (p) => p.sessions },
  { key: 'page_views', label: 'Page views', icon: Eye, fmt: fmtCompact, color: C.sky, spark: (p) => p.page_views },
  { key: 'conversion_rate', label: 'Conversion rate', icon: Percent, fmt: (v) => fmtPct(v, 2), color: C.green, spark: (p) => safeDiv(p.orders, p.sessions) },
  { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, fmt: (v) => fmtCurrency(v, { compact: true }), color: C.green, spark: (p) => p.revenue },
  { key: 'avg_order_value', label: 'Avg order value', icon: ShoppingBag, fmt: fmtCurrency, color: C.teal, spark: (p) => safeDiv(p.revenue, p.orders) },
  // No per-bucket bounce/duration/rage series exists; the sparklines show the closest available trend.
  { key: 'bounce_rate', label: 'Bounce rate', icon: TrendingDown, fmt: (v) => fmtPct(v), color: C.amber, invert: true, spark: (p) => safeDiv(p.page_views, p.sessions) },
  { key: 'avg_session_ms', label: 'Avg session', icon: Timer, fmt: fmtDuration, color: C.accent2, spark: (p) => safeDiv(p.page_views, p.sessions) },
  { key: 'rage_clicks', label: 'Rage clicks', icon: Flame, fmt: fmtNum, color: C.red, invert: true, spark: (p) => p.clicks },
];

function Kpis({ overview, series }) {
  const cur = overview.data?.current;
  const prev = overview.data?.previous;
  const points = series.data?.points || [];
  return (
    <div className="kpi-grid">
      {KPIS.map((k) => (
        <KpiCard
          key={k.key}
          label={k.label}
          icon={k.icon}
          loading={!cur}
          value={cur ? k.fmt(cur[k.key]) : ''}
          change={cur ? pctChange(cur[k.key], prev ? prev[k.key] : null) : undefined}
          invert={k.invert}
          color={k.color}
          spark={points.length > 1 ? points.map(k.spark) : series.data ? [] : null}
        />
      ))}
    </div>
  );
}

const TRAFFIC_SERIES = [
  { key: 'sessions', label: 'Sessions', color: C.accent },
  { key: 'page_views', label: 'Page views', color: C.sky },
];

function TrafficChart({ q }) {
  const [hidden, setHidden] = useState({});
  const legend = (
    <div className="legend-toggles" role="group" aria-label="Toggle series">
      {TRAFFIC_SERIES.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`legend-toggle ${hidden[s.key] ? 'is-off' : ''}`}
          aria-pressed={!hidden[s.key]}
          onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
        >
          <span className="legend-swatch" style={{ background: s.color }} />
          {s.label}
        </button>
      ))}
    </div>
  );
  return (
    <Card title="Traffic" subtitle="Sessions and page views over time" actions={legend} className="span-8">
      <Async q={q} skeleton={<SkeletonChart height={280} />} isEmpty={(d) => !d.points.some((p) => p.sessions || p.page_views)}>
        {(d) => (
          <div className="chart" style={{ height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={d.points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  {TRAFFIC_SERIES.map((s) => (
                    <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="t" {...axisProps} tickFormatter={bucketTick(d.interval)} minTickGap={28} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={48} allowDecimals={false} />
                <Tooltip cursor={lineCursor} content={<ChartTooltip labelFormatter={bucketLabel(d.interval)} valueFormatter={fmtNum} />} />
                {TRAFFIC_SERIES.map((s) =>
                  hidden[s.key] ? null : (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 3 }} />
                  ),
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Async>
    </Card>
  );
}

function DevicesCard({ q }) {
  return (
    <Card title="Devices" subtitle="Sessions by device class" className="span-4">
      <Async q={q} skeleton={<SkeletonChart height={280} />} isEmpty={(d) => !d.devices.length}>
        {(d) => {
          const total = d.devices.reduce((s, x) => s + x.sessions, 0);
          const btotal = d.browsers.reduce((s, x) => s + x.sessions, 0);
          return (
            <div className="donut-wrap">
              <div className="chart donut" style={{ height: 170 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={d.devices} dataKey="sessions" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      {d.devices.map((x, i) => <Cell key={x.name} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueFormatter={(v) => `${fmtNum(v)} · ${fmtPct((v / total) * 100)}`} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center" aria-hidden="true">
                  <strong>{fmtCompact(total)}</strong>
                  <span>sessions</span>
                </div>
              </div>
              <ul className="legend-list">
                {d.devices.map((x, i) => (
                  <li key={x.name}>
                    <span className="legend-swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="legend-name">{x.name}</span>
                    <span className="legend-val">{fmtPct((x.sessions / total) * 100)}</span>
                  </li>
                ))}
              </ul>
              {d.browsers.length > 0 && (
                <div className="browsers">
                  <h3 className="mini-title">Browsers</h3>
                  {d.browsers.slice(0, 4).map((b) => (
                    <div key={b.name} className="browser-row">
                      <span>{b.name}</span>
                      <MiniBar value={b.sessions} max={btotal} label={fmtPct((b.sessions / btotal) * 100)} width={80} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      </Async>
    </Card>
  );
}

function RevenueChart({ q }) {
  return (
    <Card title="Revenue & orders" subtitle="Purchases per bucket" className="span-8">
      <Async q={q} skeleton={<SkeletonChart height={240} />} isEmpty={(d) => !d.points.some((p) => p.orders)}>
        {(d) => (
          <div className="chart" style={{ height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={d.points} margin={{ top: 8, right: 0, left: -6, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="t" {...axisProps} tickFormatter={bucketTick(d.interval)} minTickGap={28} />
                <YAxis yAxisId="rev" {...axisProps} tickFormatter={(v) => fmtCurrency(v, { compact: true })} width={56} />
                <YAxis yAxisId="ord" orientation="right" {...axisProps} allowDecimals={false} width={32} />
                <Tooltip
                  cursor={tooltipCursor}
                  content={<ChartTooltip labelFormatter={bucketLabel(d.interval)} valueFormatter={(v, p) => (p.dataKey === 'revenue' ? fmtCurrency(v) : fmtNum(v))} />}
                />
                <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke={C.green} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Async>
    </Card>
  );
}

function FunnelMini({ q }) {
  const href = useFilterHref();
  return (
    <Card
      title="Funnel"
      subtitle="Sessions reaching each step"
      className="span-4"
      actions={<Link className="link-more" to={href('/funnel')}>Details <ArrowRight size={14} aria-hidden="true" /></Link>}
    >
      <Async q={q} isEmpty={(d) => !d.steps[0]?.sessions}>
        {(d) => (
          <ol className="funnel-mini">
            {d.steps.map((s) => (
              <li key={s.key}>
                <div className="funnel-mini-head">
                  <span>{s.label}</span>
                  <span className="muted">
                    {fmtNum(s.sessions)} · <strong>{fmtPct(s.rate_from_start)}</strong>
                  </span>
                </div>
                <div className="funnel-mini-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(s.rate_from_start, 1)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Async>
    </Card>
  );
}

function TopPages({ q }) {
  const href = useFilterHref();
  return (
    <Card title="Top pages" className="span-6" actions={<Link className="link-more" to={href('/pages')}>All pages <ArrowRight size={14} aria-hidden="true" /></Link>}>
      <Async q={q} isEmpty={(d) => !d.pages.length}>
        {(d) => {
          const rows = d.pages.slice(0, 8);
          const max = Math.max(...rows.map((r) => r.views));
          return (
            <DataTable
              dense
              caption="Top pages by views"
              rows={rows}
              rowKey={(r) => r.page_key}
              columns={[
                { key: 'page_group', label: 'Page', render: (r) => <Link to={href('/heatmap', { page: r.page_key })}><PageGroup>{r.page_group}</PageGroup></Link> },
                { key: 'views', label: 'Views', align: 'right', render: (r) => <MiniBar value={r.views} max={max} label={fmtNum(r.views)} width={60} /> },
                { key: 'sessions', label: 'Sessions', align: 'right', render: (r) => fmtNum(r.sessions) },
                { key: 'exit_rate', label: 'Exit', align: 'right', render: (r) => fmtPct(r.exit_rate) },
              ]}
            />
          );
        }}
      </Async>
    </Card>
  );
}

function TopClicks({ q }) {
  const href = useFilterHref();
  return (
    <Card title="Top clicked elements" className="span-6" actions={<Link className="link-more" to={href('/clicks')}>All clicks <ArrowRight size={14} aria-hidden="true" /></Link>}>
      <Async q={q} isEmpty={(d) => !d.top.length}>
        {(d) => {
          const rows = d.top.slice(0, 8);
          const max = Math.max(...rows.map((r) => r.count));
          return (
            <DataTable
              dense
              caption="Top clicked elements"
              rows={rows}
              rowKey={(r) => `${r.label}|${r.page_group}`}
              columns={[
                { key: 'label', label: 'Element', render: (r) => <span className="truncate" title={r.target}>{r.label}</span> },
                { key: 'page_group', label: 'Page', render: (r) => <PageGroup>{r.page_group}</PageGroup> },
                { key: 'count', label: 'Clicks', align: 'right', render: (r) => <MiniBar value={r.count} max={max} label={fmtNum(r.count)} width={60} tone="sky" /> },
              ]}
            />
          );
        }}
      </Async>
    </Card>
  );
}

function TopSearches({ q }) {
  const href = useFilterHref();
  return (
    <Card title="Top searches" className="span-6" actions={<Link className="link-more" to={href('/search')}>Search report <ArrowRight size={14} aria-hidden="true" /></Link>}>
      <Async q={q} isEmpty={(d) => !d.top.length} empty={<EmptyState compact title="No searches in this period" />}>
        {(d) => {
          const rows = d.top.slice(0, 8);
          const max = Math.max(...rows.map((r) => r.count));
          return (
            <DataTable
              dense
              caption="Top search queries"
              rows={rows}
              rowKey={(r) => r.query}
              columns={[
                { key: 'query', label: 'Query', render: (r) => <span className="query">“{r.query}”</span> },
                { key: 'count', label: 'Searches', align: 'right', render: (r) => <MiniBar value={r.count} max={max} label={fmtNum(r.count)} width={60} tone="amber" /> },
                {
                  key: 'avg_results',
                  label: 'Avg results',
                  align: 'right',
                  render: (r) => (r.avg_results === 0 ? <span className="text-bad">0</span> : fmtNum(r.avg_results)),
                },
              ]}
            />
          );
        }}
      </Async>
    </Card>
  );
}

function CategoryRevenue({ q }) {
  return (
    <Card title="Revenue by category" className="span-6">
      <Async q={q} skeleton={<SkeletonChart height={260} />} isEmpty={(d) => !d.categories.some((c) => c.revenue || c.views)}>
        {(d) => {
          const rows = d.categories.slice(0, 8);
          return (
            <div className="chart" style={{ height: Math.max(180, rows.length * 34 + 20) }}>
              <ResponsiveContainer>
                <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                  <YAxis type="category" dataKey="category" {...axisProps} width={140} tick={{ fill: '#c3c9d8', fontSize: 12 }} />
                  <Tooltip cursor={tooltipCursor} content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v)} />} />
                  <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {rows.map((r, i) => <Cell key={r.category} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        }}
      </Async>
    </Card>
  );
}

export default function Overview() {
  const f = useQueryFilters();
  const overview = useApi('/api/stats/overview', f);
  const series = useApi('/api/stats/timeseries', f);
  const funnel = useApi('/api/stats/funnel', f);
  const devices = useApi('/api/stats/devices', f);
  const pages = useApi('/api/stats/pages', f);
  const clicks = useApi('/api/stats/clicks', f);
  const search = useApi('/api/stats/search', f);
  const products = useApi('/api/stats/products', f);

  const summary = useMemo(() => {
    const c = overview.data?.current;
    if (!c) return null;
    return `${fmtNum(c.events)} events · ${fmtNum(c.orders)} orders · ${c.pages_per_session} pages / session`;
  }, [overview.data]);

  return (
    <div className="page">
      {overview.error && !overview.data ? (
        <Card><Async q={overview}>{() => null}</Async></Card>
      ) : (
        <>
          <Kpis overview={overview} series={series} />
          {summary && <p className="page-note">{summary}</p>}
        </>
      )}
      <div className="grid-12">
        <TrafficChart q={series} />
        <DevicesCard q={devices} />
        <RevenueChart q={series} />
        <FunnelMini q={funnel} />
        <TopPages q={pages} />
        <TopClicks q={clicks} />
        <TopSearches q={search} />
        <CategoryRevenue q={products} />
      </div>
      {!overview.data && !overview.error && <span className="sr-only" role="status">Loading overview</span>}
    </div>
  );
}
