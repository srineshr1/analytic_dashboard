import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { Async, Badge, Card, DeviceIcon, EmptyState, PageGroup, SkeletonRows } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { useApi } from '../lib/useApi.js';
import { useQueryFilters } from '../lib/hooks.js';
import { useFilterHref } from '../lib/filters.jsx';
import { fmtCurrency, fmtDateTime, fmtDuration, fmtNum, fmtRelative, pathOf, shortId } from '../lib/format.js';

const PAGE_SIZE = 25;

export default function Sessions() {
  const f = useQueryFilters();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const href = useFilterHref();
  const q = params.get('q') || '';
  const converted = params.get('converted') === '1';
  const pageNo = Math.max(1, Number.parseInt(params.get('p') || '1', 10) || 1);
  const [input, setInput] = useState(q);

  const patch = (obj, replace = false) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(obj)) {
          if (v === null || v === '' || v === undefined) n.delete(k);
          else n.set(k, v);
        }
        return n;
      },
      { replace },
    );

  // Debounce the id search into the URL.
  useEffect(() => {
    if (input.trim() === q) return undefined;
    const t = setTimeout(() => patch({ q: input.trim() || null, p: null }, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Reset to the first page when global filters change.
  const filterKey = `${f.range}|${f.device}`;
  const lastFilter = useRef(filterKey);
  useEffect(() => {
    if (lastFilter.current === filterKey) return;
    lastFilter.current = filterKey;
    if (pageNo !== 1) patch({ p: null }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const res = useApi('/api/sessions', {
    ...f,
    limit: PAGE_SIZE,
    skip: (pageNo - 1) * PAGE_SIZE,
    q: q || undefined,
    converted: converted ? 1 : undefined,
  });
  const total = res.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page">
      <Card>
        <div className="filter-bar">
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search by session id prefix</span>
            <input
              type="search"
              placeholder="Session id prefix…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className="switch">
            <input type="checkbox" checked={converted} onChange={(e) => patch({ converted: e.target.checked ? '1' : null, p: null })} />
            <span className="switch-ui" aria-hidden="true" />
            <span>Converted only</span>
          </label>
          <span className="muted small push-right" aria-live="polite">
            {res.data ? `${fmtNum(total)} sessions` : ''}
          </span>
        </div>

        <Async
          q={res}
          skeleton={<SkeletonRows rows={12} height={22} />}
          isEmpty={(d) => !d.sessions.length}
          empty={
            <EmptyState icon={Users} title="No sessions match">
              {q || converted ? 'Try clearing the search or the converted filter.' : 'Try a wider date range.'}
            </EmptyState>
          }
        >
          {(d) => (
            <DataTable
              caption="Sessions, most recent first"
              rows={d.sessions}
              rowKey={(r) => r.session_id}
              onRowClick={(r) => navigate(href(`/sessions/${encodeURIComponent(r.session_id)}`))}
              rowLabel={(r) => `Open journey for session ${r.session_id}`}
              columns={[
                {
                  key: 'session_id',
                  label: 'Session',
                  render: (r) => (
                    <span className="session-cell">
                      <DeviceIcon device={r.device} />
                      <span className="mono" title={r.session_id}>{shortId(r.session_id)}</span>
                    </span>
                  ),
                },
                { key: 'entry_page', label: 'Entry page', render: (r) => <PageGroup title={r.entry_page}>{pathOf(r.entry_page)}</PageGroup> },
                { key: 'unique_pages', label: 'Pages', align: 'right', render: (r) => fmtNum(r.unique_pages) },
                { key: 'total_events', label: 'Events', align: 'right', render: (r) => fmtNum(r.total_events) },
                { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => fmtNum(r.clicks) },
                { key: 'add_to_cart', label: 'Cart adds', align: 'right', render: (r) => (r.add_to_cart ? fmtNum(r.add_to_cart) : <span className="muted">0</span>) },
                {
                  key: 'revenue',
                  label: 'Revenue',
                  align: 'right',
                  render: (r) => (r.orders > 0 ? <Badge tone="green">{fmtCurrency(r.revenue)}</Badge> : <span className="muted">—</span>),
                },
                { key: 'duration_ms', label: 'Duration', align: 'right', render: (r) => fmtDuration(r.duration_ms) },
                {
                  key: 'last_seen',
                  label: 'Last seen',
                  align: 'right',
                  render: (r) => <time dateTime={r.last_seen} title={fmtDateTime(r.last_seen)}>{fmtRelative(r.last_seen)}</time>,
                },
              ]}
            />
          )}
        </Async>

        {res.data && total > PAGE_SIZE && (
          <nav className="pager" aria-label="Pagination">
            <button type="button" className="btn btn-sm" disabled={pageNo <= 1} onClick={() => patch({ p: pageNo - 1 > 1 ? pageNo - 1 : null })}>
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <span className="muted small">
              Page {fmtNum(pageNo)} of {fmtNum(pages)}
            </span>
            <button type="button" className="btn btn-sm" disabled={pageNo >= pages} onClick={() => patch({ p: pageNo + 1 })}>
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </nav>
        )}
      </Card>
    </div>
  );
}
