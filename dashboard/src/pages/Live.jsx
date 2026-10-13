import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pause, Play, Radio } from 'lucide-react';
import { Async, Card, DeviceIcon, EmptyState, PageGroup, SkeletonChart, SkeletonRows } from '../components/ui.jsx';
import { C, ChartTooltip, axisProps, gridProps, tooltipCursor } from '../components/charts.jsx';
import { useApi } from '../lib/useApi.js';
import { useFilterHref, useFilters } from '../lib/filters.jsx';
import { describeEvent, metaFor } from '../lib/events.js';
import { fmtHour, fmtNum, fmtRelative, fmtTime, shortId } from '../lib/format.js';

/** Fill the last 30 one-minute buckets so the chart has a steady x axis. */
function lastThirtyMinutes(points = []) {
  const by = new Map(points.map((p) => [Math.floor(new Date(p.t).getTime() / 60e3), p.events]));
  const nowMin = Math.floor(Date.now() / 60e3);
  return Array.from({ length: 30 }, (_, i) => {
    const m = nowMin - 29 + i;
    return { t: m * 60e3, events: by.get(m) || 0 };
  });
}

export function EventRow({ e, isNew, showSession = true, href }) {
  const meta = metaFor(e.event_type);
  const Icon = meta.icon;
  return (
    <li className={`stream-row ${isNew ? 'is-new' : ''}`}>
      <span className="event-icon" style={{ '--c': meta.color }} title={meta.label}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <div className="stream-main">
        <p className="stream-desc">{describeEvent(e)}</p>
        <p className="stream-meta">
          {showSession && (
            <>
              <Link to={href(`/sessions/${encodeURIComponent(e.session_id)}`)} className="session-link mono" title={`Open journey for ${e.session_id}`}>
                {shortId(e.session_id)}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          )}
          <DeviceIcon device={e.device} size={12} />
          <span aria-hidden="true">·</span>
          <span>{meta.label}</span>
        </p>
      </div>
      <time className="stream-time" dateTime={new Date(e.timestamp).toISOString()} title={fmtTime(e.timestamp)}>
        {fmtRelative(e.timestamp)}
      </time>
    </li>
  );
}

export default function Live() {
  const [paused, setPaused] = useState(false);
  const { device } = useFilters();
  const href = useFilterHref();
  const q = useApi('/api/live', { limit: 50 }, { interval: paused ? 0 : 3000 });
  const seen = useRef(null);
  const [fresh, setFresh] = useState(new Set());
  const [, forceTick] = useState(0);

  // Highlight events that weren't in the previous poll.
  useEffect(() => {
    const recent = q.data?.recent;
    if (!recent) return;
    const ids = new Set(recent.map((e) => e._id));
    if (seen.current) setFresh(new Set([...ids].filter((id) => !seen.current.has(id))));
    seen.current = ids;
  }, [q.data]);

  // Keep relative times ticking while paused.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const data = q.data;
  const recent = useMemo(() => (data?.recent || []).filter((e) => !device || e.device === device), [data, device]);
  const sessions = useMemo(() => (data?.sessions || []).filter((s) => !device || s.device === device), [data, device]);
  const perMinute = useMemo(() => lastThirtyMinutes(data?.events_per_minute), [data]);
  const active = device ? sessions.length : data?.active_sessions;
  const lastMin = perMinute.at(-1)?.events ?? 0;

  return (
    <div className="page">
      <div className="grid-12">
        <Card className="span-4 live-hero" title="Active sessions" subtitle="Seen in the last 5 minutes">
          {data ? (
            <div className="live-count">
              <span className={`pulse pulse-lg ${paused ? 'is-off' : ''}`} aria-hidden="true" />
              <strong aria-live="polite">{fmtNum(active)}</strong>
              <span className="muted">{device ? `${device} sessions` : 'sessions right now'}</span>
            </div>
          ) : q.error ? (
            <Async q={q}>{() => null}</Async>
          ) : (
            <SkeletonRows rows={2} height={36} />
          )}
          <div className="live-controls">
            <button type="button" className="btn btn-sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
            <span className="muted small">
              {paused ? 'Updates paused' : 'Refreshing every 3s'}
              {q.updatedAt ? ` · updated ${fmtTime(q.updatedAt)}` : ''}
            </span>
          </div>
          {device && <p className="muted small">Filtered client-side to {device}; the per-minute chart includes all devices.</p>}
        </Card>

        <Card className="span-8" title="Events per minute" subtitle={`Last 30 minutes · ${fmtNum(lastMin)} this minute`}>
          <Async q={q} skeleton={<SkeletonChart height={200} />}>
            {() => (
              <div className="chart" style={{ height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={perMinute} margin={{ top: 6, right: 0, left: -18, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="t" {...axisProps} tickFormatter={fmtHour} minTickGap={36} />
                    <YAxis {...axisProps} allowDecimals={false} width={54} />
                    <Tooltip cursor={tooltipCursor} content={<ChartTooltip labelFormatter={fmtHour} valueFormatter={fmtNum} />} />
                    <Bar dataKey="events" name="Events" fill={C.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Async>
        </Card>

        <Card className="span-8" title="Event stream" subtitle="Most recent 50 events">
          <Async
            q={q}
            isEmpty={() => !recent.length}
            empty={
              <EmptyState icon={Radio} title="Waiting for events">
                Open the <a href="/store/" target="_blank" rel="noopener noreferrer">store</a> in another tab and click around.
              </EmptyState>
            }
          >
            {() => (
              <ol className="stream" aria-label="Recent events">
                {recent.map((e) => <EventRow key={e._id} e={e} isNew={fresh.has(e._id)} href={href} />)}
              </ol>
            )}
          </Async>
        </Card>

        <Card className="span-4" title="Active sessions" subtitle="Most recent activity first">
          <Async q={q} isEmpty={() => !sessions.length} empty={<EmptyState compact title="No one is browsing right now" />}>
            {() => (
              <ul className="active-list">
                {sessions.map((s) => (
                  <li key={s.session_id}>
                    <Link to={href(`/sessions/${encodeURIComponent(s.session_id)}`)} className="active-row">
                      <DeviceIcon device={s.device} />
                      <span className="active-main">
                        <span className="mono">{shortId(s.session_id)}</span>
                        <PageGroup>{s.last_page}</PageGroup>
                      </span>
                      <span className="active-side">
                        <span>{fmtNum(s.events)} ev</span>
                        <span className="muted small">{fmtRelative(s.last_seen)}</span>
                      </span>
                    </Link>
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
