import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { ArrowRight, Workflow } from 'lucide-react';
import { Async, Card, EmptyState, MiniBar, PageGroup, Segmented, SkeletonChart } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { PALETTE } from '../components/charts.jsx';
import { useApi } from '../lib/useApi.js';
import { useQueryFilters } from '../lib/hooks.js';
import { fmtNum, fmtPct } from '../lib/format.js';

const EXIT = '(exit)';
const STEP_OPTS = [3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} steps` }));

/** Stable colour per page group. */
function colorFor(name) {
  if (name === EXIT) return '#4b5368';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Labels sit to the right of each node; the chart keeps a right margin so the
// last column's labels fit. Text has a dark halo (CSS paint-order) to stay legible over links.
function SankeyNode({ x, y, width, height, payload }) {
  const color = colorFor(payload.name);
  const tx = x + width + 8;
  const anchor = 'start';
  const showLabel = height >= 4;
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} rx={2} fill={color} fillOpacity={0.95} />
      {showLabel && (
        <text x={tx} y={y + height / 2} textAnchor={anchor} dominantBaseline="middle" className="sankey-label">
          <tspan className="sankey-label-name">{payload.name}</tspan>
          <tspan className="sankey-label-count" dx={6}>{fmtNum(payload.value)}</tspan>
        </text>
      )}
    </g>
  );
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) {
  const color = colorFor(payload.source?.name || '');
  return (
    <path
      className="sankey-link"
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      stroke={color}
      strokeWidth={Math.max(linkWidth, 1)}
      fill="none"
    />
  );
}

function SankeyTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const p = item.payload || {};
  const isLink = p.source && p.target;
  return (
    <div className="chart-tooltip">
      {isLink ? (
        <div className="chart-tooltip-label">
          {p.source.name} <ArrowRight size={11} aria-hidden="true" /> {p.target.name}
        </div>
      ) : (
        <div className="chart-tooltip-label">{item.name}</div>
      )}
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name">Sessions</span>
        <span className="chart-tooltip-value">
          {fmtNum(item.value)}
          {total ? ` · ${fmtPct((item.value / total) * 100)}` : ''}
        </span>
      </div>
    </div>
  );
}

export default function Flows() {
  const f = useQueryFilters();
  const [params, setParams] = useSearchParams();
  const steps = ['3', '4', '5', '6'].includes(params.get('steps')) ? params.get('steps') : '4';
  const q = useApi('/api/stats/flows', { ...f, steps, links: 40 });

  const setSteps = (s) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('steps', s);
      return n;
    });

  const graph = useMemo(() => {
    if (!q.data?.links?.length) return null;
    // Recharts mutates nothing, but give it fresh objects to be safe across refetches.
    const nodes = q.data.nodes.map((n) => ({ ...n }));
    const links = q.data.links.filter((l) => l.value > 0).map((l) => ({ ...l }));
    const perStep = {};
    for (const n of nodes) perStep[n.step] = (perStep[n.step] || 0) + 1;
    const maxCol = Math.max(...Object.values(perStep));
    return { data: { nodes, links }, height: Math.max(380, maxCol * 56) };
  }, [q.data]);

  const transitionsTotal = q.data?.transitions?.reduce((s, t) => s + t.count, 0) || 0;
  const maxT = q.data?.transitions?.[0]?.count || 0;

  return (
    <div className="page">
      <Card
        title="Navigation flow"
        subtitle={q.data ? `How ${fmtNum(q.data.sessions)} sessions moved between pages (first ${steps} page views)` : 'How sessions moved between pages'}
        actions={<Segmented label="Number of steps" options={STEP_OPTS} value={steps} onChange={setSteps} size="sm" />}
      >
        <Async
          q={q}
          skeleton={<SkeletonChart height={380} />}
          isEmpty={() => !graph}
          empty={
            <EmptyState icon={Workflow} title="No navigation paths yet">
              Flows appear once sessions view at least one page in the selected period.
            </EmptyState>
          }
        >
          {() => (
            <div className="sankey-scroll">
              <div className="chart sankey" style={{ height: graph.height, minWidth: Number(steps) * 190 }}>
                <ResponsiveContainer>
                  <Sankey
                    data={graph.data}
                    node={<SankeyNode />}
                    link={<SankeyLink />}
                    nodePadding={22}
                    nodeWidth={10}
                    linkCurvature={0.5}
                    iterations={64}
                    align="left"
                    margin={{ top: 12, right: 150, bottom: 12, left: 8 }}
                  >
                    <Tooltip content={<SankeyTooltip total={q.data.sessions} />} />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Async>
      </Card>

      <Card title="Top transitions" subtitle="Most common page-to-page moves across all steps">
        <Async q={q} isEmpty={(d) => !d.transitions.length} empty={<EmptyState compact title="No page-to-page transitions in this period" />}>
          {(d) => (
            <DataTable
              caption="Top page transitions"
              rows={d.transitions}
              rowKey={(r) => `${r.from}→${r.to}`}
              sortable
              columns={[
                {
                  key: 'from',
                  label: 'From → To',
                  sortValue: (r) => `${r.from} ${r.to}`,
                  render: (r) => (
                    <span className="transition">
                      <PageGroup>{r.from}</PageGroup>
                      <ArrowRight size={13} aria-label="to" />
                      <PageGroup>{r.to}</PageGroup>
                    </span>
                  ),
                },
                { key: 'count', label: 'Sessions', align: 'right', render: (r) => fmtNum(r.count) },
                {
                  key: 'share',
                  label: 'Share',
                  align: 'right',
                  sortValue: (r) => r.count,
                  render: (r) => <MiniBar value={r.count} max={maxT} label={fmtPct((r.count / transitionsTotal) * 100)} />,
                },
              ]}
            />
          )}
        </Async>
      </Card>
    </div>
  );
}
