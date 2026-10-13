import { api } from '../api.js';
import { useAsync, fmtTime, fmtDuration, shortUrl } from '../util.js';

export default function SessionJourney({ sessionId }) {
  const { data, error, loading } = useAsync(() => api.sessionEvents(sessionId), [sessionId]);
  const events = data?.events ?? [];
  const start = events.length ? new Date(events[0].timestamp) : null;

  return (
    <section className="panel journey" aria-labelledby="journey-title">
      <div className="panel-head">
        <h2 id="journey-title">User journey</h2>
        <a href="#/sessions" className="btn" aria-label="Close journey">✕</a>
      </div>
      <p className="mono muted small">{sessionId}</p>

      {loading && <p>Loading…</p>}
      {error && <p className="error" role="alert">{error.message}</p>}

      {!loading && !error && (
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={e._id ?? i} className={`step ${e.event_type}`}>
              <div className="step-head">
                <span className={`badge ${e.event_type}`}>{e.event_type === 'page_view' ? 'Page view' : 'Click'}</span>
                <span className="muted small" title={fmtTime(e.timestamp)}>
                  +{fmtDuration(new Date(e.timestamp) - start)}
                </span>
              </div>
              <div className="step-url" title={e.page_url}>
                <a href={`#/heatmap?page=${encodeURIComponent(e.page_key || e.page_url)}`} title="Open heatmap for this page">
                  {shortUrl(e.page_url)}
                </a>
              </div>
              {e.event_type === 'click' && (
                <div className="muted small">
                  at ({e.x}, {e.y}){e.target && <> on <code>{e.target}</code></>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
