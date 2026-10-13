import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Eye, Flame, LogIn, LogOut, MousePointerClick, Zap } from 'lucide-react';
import { Badge, Card, DeviceIcon, ErrorState, PageGroup, Skeleton, SkeletonRows } from '../components/ui.jsx';
import { useApi } from '../lib/useApi.js';
import { useFilterHref } from '../lib/filters.jsx';
import { describeEvent, metaFor } from '../lib/events.js';
import { fmtCurrency, fmtDateTime, fmtDuration, fmtNum, fmtOffset, fmtRelative, plural } from '../lib/format.js';

const ts = (e) => new Date(e.timestamp).getTime();

/** Splits a chronological event list into page visits. */
function toVisits(events) {
  const visits = [];
  let cur = null;
  for (const e of events) {
    if (!cur || e.event_type === 'page_view' || e.page_key !== cur.page_key) {
      cur = { page_key: e.page_key, page_group: e.page_group, page_url: e.page_url, start: ts(e), events: [] };
      visits.push(cur);
    }
    cur.events.push(e);
  }
  visits.forEach((v, i) => {
    const measured = v.events.filter((e) => e.event_type === 'time_on_page').reduce((s, e) => s + (e.props?.duration_ms || 0), 0);
    const next = visits[i + 1];
    const end = next ? next.start : ts(v.events.at(-1));
    v.duration = measured || Math.max(0, end - v.start);
    v.measured = Boolean(measured);
  });
  return visits;
}

function Stat({ icon: Icon, label, children }) {
  return (
    <div className="j-stat">
      <span className="j-stat-label">
        {Icon && <Icon size={13} aria-hidden="true" />}
        {label}
      </span>
      <span className="j-stat-value">{children}</span>
    </div>
  );
}

export default function Journey() {
  const { id } = useParams();
  const href = useFilterHref();
  const q = useApi(`/api/sessions/${encodeURIComponent(id)}/events`);

  const model = useMemo(() => {
    const events = q.data?.events;
    if (!events?.length) return null;
    const start = ts(events[0]);
    const end = ts(events.at(-1));
    const purchases = events.filter((e) => e.event_type === 'purchase');
    const visits = toVisits(events);
    return {
      start,
      end,
      visits,
      device: events.find((e) => e.device)?.device,
      revenue: purchases.reduce((s, e) => s + (e.props?.value || 0), 0),
      orders: purchases.length,
      pageViews: events.filter((e) => e.event_type === 'page_view').length,
      clicks: events.filter((e) => e.event_type === 'click').length,
      rage: events.filter((e) => e.event_type === 'rage_click').length,
      viewport: events.find((e) => e.viewport_width)?.viewport_width,
    };
  }, [q.data]);

  const back = (
    <Link to={href('/sessions')} className="link-more back-link">
      <ArrowLeft size={14} aria-hidden="true" /> All sessions
    </Link>
  );

  if (q.error && !q.data) {
    return (
      <div className="page">
        {back}
        <Card>
          <ErrorState error={q.error.status === 404 ? { message: 'Session not found' } : q.error} onRetry={q.reload} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      {back}
      <Card className="journey-head">
        {!model ? (
          <div className="j-stats">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={40} />)}
          </div>
        ) : (
          <>
            <div className="journey-title">
              <DeviceIcon device={model.device} size={18} />
              <h2 className="mono" title={id}>{id}</h2>
              {model.orders > 0 ? <Badge tone="green">Converted · {fmtCurrency(model.revenue)}</Badge> : <Badge>Not converted</Badge>}
              {model.rage > 0 && <Badge tone="red">{plural(model.rage, 'rage click')}</Badge>}
            </div>
            <p className="muted small">
              Started {fmtDateTime(model.start)} ({fmtRelative(model.start)}){model.viewport ? ` · ${model.device || 'unknown'} · ${model.viewport}px viewport` : ''}
            </p>
            <div className="j-stats">
              <Stat icon={Clock} label="Duration">{fmtDuration(model.end - model.start)}</Stat>
              <Stat icon={Eye} label="Page views">{fmtNum(model.pageViews)}</Stat>
              <Stat icon={Zap} label="Events">{fmtNum(q.data.count)}</Stat>
              <Stat icon={MousePointerClick} label="Clicks">{fmtNum(model.clicks)}</Stat>
              <Stat icon={LogIn} label="Entry"><PageGroup>{model.visits[0].page_group}</PageGroup></Stat>
              <Stat icon={LogOut} label="Exit"><PageGroup>{model.visits.at(-1).page_group}</PageGroup></Stat>
            </div>
          </>
        )}
      </Card>

      <Card title="Journey" subtitle={model ? `${plural(model.visits.length, 'page visit')} in chronological order` : undefined}>
        {!model ? (
          <SkeletonRows rows={10} height={24} />
        ) : (
          <ol className="timeline">
            {model.visits.map((v, vi) => (
              <li key={`${v.start}-${vi}`} className="visit">
                <div className="visit-head">
                  <span className="visit-dot" aria-hidden="true" />
                  <span className="visit-index">{vi + 1}</span>
                  <PageGroup title={v.page_url}>{v.page_group}</PageGroup>
                  <span className="muted small">
                    {fmtOffset(v.start - model.start)} · {v.measured ? '' : '~'}
                    {fmtDuration(v.duration)} on page
                  </span>
                  <span className="visit-links">
                    <Link to={href('/heatmap', { page: v.page_key })} className="link-more" title="Click heatmap for this page">
                      <MousePointerClick size={13} aria-hidden="true" /> Heatmap
                    </Link>
                    {v.events.some((e) => e.event_type === 'rage_click') && (
                      <Link to={href('/heatmap', { page: v.page_key, type: 'rage_click' })} className="link-more text-bad" title="Rage-click heatmap for this page">
                        <Flame size={13} aria-hidden="true" /> Rage
                      </Link>
                    )}
                  </span>
                </div>
                <ul className="visit-events">
                  {v.events.map((e, i) => {
                    const meta = metaFor(e.event_type);
                    const Icon = meta.icon;
                    const isClick = e.event_type === 'click' || e.event_type === 'rage_click';
                    return (
                      <li key={e._id || i} className={`tl-event type-${e.event_type}`}>
                        <span className="event-icon" style={{ '--c': meta.color }} title={meta.label}>
                          <Icon size={13} aria-hidden="true" />
                        </span>
                        <span className="tl-desc">
                          {describeEvent(e)}
                          {isClick && (
                            <span className="muted small tl-coords">
                              ({Math.round(e.x)}, {Math.round(e.y)}){e.target ? <code className="selector">{e.target}</code> : null}
                            </span>
                          )}
                        </span>
                        <time className="tl-time mono" dateTime={new Date(e.timestamp).toISOString()} title={fmtDateTime(e.timestamp)}>
                          {fmtOffset(ts(e) - model.start)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
