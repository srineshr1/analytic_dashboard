import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Flame, MousePointerClick, TriangleAlert } from 'lucide-react';
import { Async, Card, EmptyState, MiniBar, PageGroup, SkeletonChart } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { C, ChartTooltip, axisProps, tooltipCursor } from '../components/charts.jsx';
import { useApi } from '../lib/useApi.js';
import { usePageIndex, useQueryFilters } from '../lib/hooks.js';
import { useFilterHref } from '../lib/filters.jsx';
import { fmtNum } from '../lib/format.js';

const trim = (s, n = 26) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

function HBar({ data, dataKey, nameKey, color, height }) {
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} allowDecimals={false} />
          <YAxis type="category" dataKey={nameKey} {...axisProps} width={190} tick={{ fill: '#c3c9d8', fontSize: 12 }} tickFormatter={(v) => trim(v, 30)} />
          <Tooltip cursor={tooltipCursor} content={<ChartTooltip valueFormatter={fmtNum} />} />
          <Bar dataKey={dataKey} name="Clicks" fill={color} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Clicks() {
  const f = useQueryFilters();
  const q = useApi('/api/stats/clicks', { ...f, limit: 25 });
  const pages = usePageIndex(f.range);
  const href = useFilterHref();
  const heatHref = (group, type) => {
    const key = pages.get(group)?.page_url;
    return key ? href('/heatmap', { page: key, type }) : null;
  };

  return (
    <div className="page">
      <div className="grid-12">
        <Card title="Most clicked elements" subtitle="Top 10 by clicks" className="span-7">
          <Async q={q} skeleton={<SkeletonChart height={320} />} isEmpty={(d) => !d.top.length} empty={<EmptyState icon={MousePointerClick} title="No clicks in this period" />}>
            {(d) => {
              const top = d.top.slice(0, 10);
              const dup = new Set(top.map((r) => r.label).filter((l, i, a) => a.indexOf(l) !== i));
              // Same element on several pages: add the page so bars are distinguishable.
              const rows = top.map((r) => ({ ...r, name: dup.has(r.label) ? `${r.label} · ${(r.page_group || '').replace(/^\/store/, '') || '/'}` : r.label }));
              return <HBar data={rows} dataKey="count" nameKey="name" color={C.sky} height={Math.max(200, rows.length * 32 + 20)} />;
            }}
          </Async>
        </Card>

        <Card title="Clicks by page" className="span-5">
          <Async q={q} skeleton={<SkeletonChart height={320} />} isEmpty={(d) => !d.by_page.length} empty={<EmptyState compact title="No clicks in this period" />}>
            {(d) => <HBar data={d.by_page.slice(0, 10)} dataKey="count" nameKey="page_group" color={C.accent} height={Math.max(200, Math.min(d.by_page.length, 10) * 32 + 20)} />}
          </Async>
        </Card>

        <Card title="Rage-click hotspots" subtitle="Repeated rapid clicks — usually broken or unresponsive UI" className="span-12 card-warn">
          <Async
            q={q}
            isEmpty={(d) => !d.rage.length}
            empty={<EmptyState compact icon={Flame} title="No rage clicks in this period">Nice — nothing looks broken.</EmptyState>}
          >
            {(d) => (
              <ul className="rage-list">
                {d.rage.map((r) => {
                  const link = heatHref(r.page_group, 'rage_click');
                  return (
                    <li key={`${r.label}|${r.page_group}`} className="rage-item">
                      <span className="rage-icon" aria-hidden="true"><TriangleAlert size={16} /></span>
                      <div className="rage-main">
                        <p className="rage-label" title={r.target}>{r.label}</p>
                        <p className="muted small">
                          <PageGroup>{r.page_group}</PageGroup>
                          {r.target && <code className="selector">{r.target}</code>}
                        </p>
                      </div>
                      <div className="rage-nums">
                        <strong>{fmtNum(r.count)}</strong>
                        <span className="muted small">{fmtNum(r.sessions)} sessions</span>
                      </div>
                      {link ? (
                        <Link to={link} className="btn btn-sm btn-warn">
                          <Flame size={14} aria-hidden="true" /> Rage heatmap
                        </Link>
                      ) : (
                        <span className="btn btn-sm is-disabled" aria-disabled="true">No heatmap</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Async>
        </Card>

        <Card title="All clicked elements" className="span-12">
          <Async q={q} isEmpty={(d) => !d.top.length} empty={<EmptyState compact title="No clicks in this period" />}>
            {(d) => {
              const max = d.top[0]?.count || 0;
              return (
                <DataTable
                  caption="Clicked elements with page, click count and sessions"
                  rows={d.top}
                  rowKey={(r) => `${r.label}|${r.page_group}`}
                  sortable
                  defaultSort={{ key: 'count', dir: 'desc' }}
                  columns={[
                    { key: 'label', label: 'Element', render: (r) => <span className="page-cell"><span>{r.label}</span>{r.target && <code className="selector">{r.target}</code>}</span> },
                    {
                      key: 'page_group',
                      label: 'Page',
                      render: (r) => {
                        const link = heatHref(r.page_group, 'click');
                        return link ? <Link to={link} title="Open click heatmap"><PageGroup>{r.page_group}</PageGroup></Link> : <PageGroup>{r.page_group}</PageGroup>;
                      },
                    },
                    { key: 'count', label: 'Clicks', align: 'right', render: (r) => <MiniBar value={r.count} max={max} label={fmtNum(r.count)} tone="sky" /> },
                    { key: 'sessions', label: 'Sessions', align: 'right', render: (r) => fmtNum(r.sessions) },
                  ]}
                />
              );
            }}
          </Async>
        </Card>
      </div>
    </div>
  );
}
