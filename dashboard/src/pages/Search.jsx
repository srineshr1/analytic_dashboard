import { Hash, Search as SearchIcon, SearchX, Users } from 'lucide-react';
import { Async, Card, EmptyState, MiniBar, SkeletonRows } from '../components/ui.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { useApi } from '../lib/useApi.js';
import { useQueryFilters } from '../lib/hooks.js';
import { fmtCompact, fmtNum, fmtPct } from '../lib/format.js';

export default function Search() {
  const f = useQueryFilters();
  const q = useApi('/api/stats/search', f);
  const d = q.data;

  return (
    <div className="page">
      <div className="kpi-grid kpi-grid-4">
        <KpiCard label="Total searches" icon={SearchIcon} loading={!d} value={d && fmtCompact(d.total)} />
        <KpiCard label="Unique queries" icon={Hash} loading={!d} value={d && fmtCompact(d.unique_queries)} />
        <KpiCard label="Zero-result rate" icon={SearchX} loading={!d} value={d && fmtPct(d.zero_result_rate)} hint={d && d.zero_result_rate > 10 ? 'High — check synonyms and catalogue coverage' : undefined} />
        <KpiCard label="Searching sessions" icon={Users} loading={!d} value={d && fmtCompact(d.sessions)} />
      </div>

      <div className="grid-12">
        <Card title="Top queries" subtitle="Most frequent searches" className="span-8">
          <Async q={q} skeleton={<SkeletonRows rows={10} />} isEmpty={(x) => !x.top.length} empty={<EmptyState icon={SearchIcon} title="No searches in this period" />}>
            {(x) => {
              const max = x.top[0]?.count || 1;
              return (
                <DataTable
                  sortable
                  caption="Top search queries"
                  rows={x.top}
                  rowKey={(r) => r.query}
                  rowClassName={(r) => (r.avg_results === 0 ? 'row-warn' : '')}
                  columns={[
                    { key: 'query', label: 'Query', render: (r) => <span className="query">“{r.query}”</span> },
                    { key: 'count', label: 'Searches', align: 'right', render: (r) => <MiniBar value={r.count} max={max} label={fmtNum(r.count)} tone="amber" /> },
                    { key: 'sessions', label: 'Sessions', align: 'right', render: (r) => fmtNum(r.sessions) },
                    { key: 'avg_results', label: 'Avg results', align: 'right', render: (r) => (r.avg_results === 0 ? <span className="text-bad">0</span> : fmtNum(r.avg_results)) },
                    { key: 'zero', label: 'Zero-result', align: 'right', render: (r) => (r.zero ? <span className="text-bad">{fmtNum(r.zero)}</span> : <span className="muted">0</span>) },
                  ]}
                />
              );
            }}
          </Async>
        </Card>

        <Card title="Zero-result queries" subtitle="Searches that found nothing" className="span-4 card-warn">
          <Async q={q} skeleton={<SkeletonRows rows={8} />} isEmpty={(x) => !x.zero_results.length} empty={<EmptyState compact icon={SearchX} title="Every search found something" />}>
            {(x) => (
              <ul className="zero-list">
                {x.zero_results.map((r) => (
                  <li key={r.query}>
                    <SearchX size={14} aria-hidden="true" />
                    <span className="query">“{r.query}”</span>
                    <span className="zero-count">
                      <strong>{fmtNum(r.zero)}</strong>
                      <span className="muted small"> of {fmtNum(r.count)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
      </div>
    </div>
  );
}
