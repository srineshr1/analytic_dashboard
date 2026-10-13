import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Async, Card, EmptyState, MiniBar, PageGroup, SkeletonRows } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { useApi } from '../lib/useApi.js';
import { useQueryFilters } from '../lib/hooks.js';
import { useFilterHref } from '../lib/filters.jsx';
import { fmtDuration, fmtNum, fmtPct, pathOf } from '../lib/format.js';

export default function Pages() {
  const f = useQueryFilters();
  const q = useApi('/api/stats/pages', f);
  const navigate = useNavigate();
  const href = useFilterHref();

  return (
    <div className="page">
      <Card title="Page engagement" subtitle="Click a row to open its heatmap. Columns are sortable.">
        <Async
          q={q}
          skeleton={<SkeletonRows rows={10} height={22} />}
          isEmpty={(d) => !d.pages.length}
          empty={<EmptyState icon={FileText} title="No page views in this period" />}
        >
          {({ pages }) => {
            const maxViews = Math.max(...pages.map((p) => p.views));
            return (
              <DataTable
                caption="Pages with views, sessions, time on page, scroll depth, clicks, entries and exits"
                rows={pages}
                rowKey={(r) => r.page_key}
                sortable
                defaultSort={{ key: 'views', dir: 'desc' }}
                onRowClick={(r) => navigate(href('/heatmap', { page: r.page_key }))}
                rowLabel={(r) => `Open heatmap for ${r.page_group}`}
                rowClassName={(r) => (r.rage_clicks > 0 ? 'row-warn' : '')}
                columns={[
                  {
                    key: 'page_group',
                    label: 'Page',
                    render: (r) => (
                      <span className="page-cell">
                        <PageGroup>{r.page_group}</PageGroup>
                        <span className="muted small truncate" title={r.sample_url}>e.g. {pathOf(r.sample_url)}</span>
                      </span>
                    ),
                  },
                  { key: 'views', label: 'Views', align: 'right', render: (r) => <MiniBar value={r.views} max={maxViews} label={fmtNum(r.views)} width={56} /> },
                  { key: 'sessions', label: 'Sessions', align: 'right', render: (r) => fmtNum(r.sessions) },
                  { key: 'avg_time_ms', label: 'Avg time', align: 'right', render: (r) => (r.avg_time_ms ? fmtDuration(r.avg_time_ms) : '—') },
                  { key: 'avg_scroll', label: 'Avg scroll', align: 'right', render: (r) => <MiniBar value={r.avg_scroll} max={100} label={fmtPct(r.avg_scroll, 0)} width={56} tone="teal" /> },
                  { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => fmtNum(r.clicks) },
                  { key: 'rage_clicks', label: 'Rage', align: 'right', render: (r) => (r.rage_clicks ? <span className="text-bad">{fmtNum(r.rage_clicks)}</span> : '0') },
                  { key: 'entries', label: 'Entries', align: 'right', render: (r) => fmtNum(r.entries) },
                  { key: 'exits', label: 'Exits', align: 'right', render: (r) => fmtNum(r.exits) },
                  { key: 'exit_rate', label: 'Exit rate', align: 'right', render: (r) => fmtPct(r.exit_rate) },
                ]}
              />
            );
          }}
        </Async>
      </Card>
    </div>
  );
}
