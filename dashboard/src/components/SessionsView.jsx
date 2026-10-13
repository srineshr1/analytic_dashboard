import { useState } from 'react';
import { api } from '../api.js';
import { useAsync, fmtTime, fmtDuration, shortUrl } from '../util.js';
import SessionJourney from './SessionJourney.jsx';

const PAGE_SIZE = 25;

export default function SessionsView({ selectedId }) {
  const [skip, setSkip] = useState(0);
  const { data, error, loading, reload } = useAsync(() => api.sessions(PAGE_SIZE, skip), [skip]);

  const total = data?.total ?? 0;
  const sessions = data?.sessions ?? [];

  return (
    <div className={`sessions-layout ${selectedId ? 'with-detail' : ''}`}>
      <section className="panel" aria-labelledby="sessions-title">
        <div className="panel-head">
          <h2 id="sessions-title">
            Sessions <span className="muted">({total})</span>
          </h2>
          <button className="btn" onClick={reload} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="error" role="alert">Failed to load sessions: {error.message}</p>}
        {!error && !loading && sessions.length === 0 && (
          <p className="empty">
            No sessions yet. Open the <a href="/demo/" target="_blank" rel="noreferrer">demo site</a> and click around.
          </p>
        )}

        {sessions.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Entry page</th>
                  <th scope="col" className="num">Events</th>
                  <th scope="col" className="num">Views</th>
                  <th scope="col" className="num">Clicks</th>
                  <th scope="col" className="num">Pages</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const selected = s.session_id === selectedId;
                  return (
                    <tr key={s.session_id} className={selected ? 'selected' : ''}>
                      <td>
                        <a
                          href={`#/sessions/${encodeURIComponent(s.session_id)}`}
                          className="mono"
                          aria-current={selected ? 'true' : undefined}
                          title={s.session_id}
                        >
                          {s.session_id.slice(0, 8)}…
                        </a>
                      </td>
                      <td className="truncate" title={s.entry_page}>{shortUrl(s.entry_page)}</td>
                      <td className="num"><strong>{s.total_events}</strong></td>
                      <td className="num">{s.page_views}</td>
                      <td className="num">{s.clicks}</td>
                      <td className="num">{s.unique_pages}</td>
                      <td>{fmtDuration(new Date(s.last_seen) - new Date(s.first_seen))}</td>
                      <td>{fmtTime(s.last_seen)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="pager">
            <button className="btn" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
              ← Prev
            </button>
            <span>
              {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
            </span>
            <button className="btn" disabled={skip + PAGE_SIZE >= total} onClick={() => setSkip(skip + PAGE_SIZE)}>
              Next →
            </button>
          </div>
        )}
      </section>

      {selectedId && <SessionJourney sessionId={selectedId} />}
    </div>
  );
}
