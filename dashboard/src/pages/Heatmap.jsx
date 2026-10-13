import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flame, Grid3x3, Layers, MousePointerClick, ScanEye, Sparkles } from 'lucide-react';
import { Async, Card, EmptyState, ErrorState, PageGroup, Segmented, Skeleton, SkeletonRows } from '../components/ui.jsx';
import { useApi } from '../lib/useApi.js';
import { useFilterHref, useFilters } from '../lib/filters.jsx';
import { useQueryFilters } from '../lib/hooks.js';
import { GRID_CELL, HEAT_GRADIENT_CSS, drawDots, drawGrid, drawHeat, gridCounts } from '../lib/heat.js';
import { fmtNum, fmtPct, fmtRelative } from '../lib/format.js';

const REF_WIDTH = { desktop: 1280, tablet: 820, mobile: 390 };
const MAX_H = 10000;
const DEFAULT_H = 900;

const TYPE_OPTS = [
  { value: 'click', label: 'Clicks', icon: MousePointerClick },
  { value: 'rage_click', label: 'Rage clicks', icon: Flame },
];
const MODE_OPTS = [
  { value: 'dots', label: 'Dots', icon: ScanEye },
  { value: 'heat', label: 'Heat', icon: Sparkles },
  { value: 'grid', label: 'Grid', icon: Grid3x3 },
];

/** Tracks an element's content width. Uses a callback ref so it works when the node mounts late. */
function useElementWidth() {
  const [width, setWidth] = useState(0);
  const ro = useRef(null);
  const ref = useCallback((node) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    ro.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.current.observe(node);
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return [ref, width];
}

function previewUrl(sample) {
  if (!sample) return null;
  try {
    const u = new URL(sample, window.location.origin);
    u.searchParams.set('ua_preview', '1');
    return u.toString();
  } catch {
    return null;
  }
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function ScrollPanel({ q, pageHeight }) {
  return (
    <Card title="Scroll depth" subtitle="Share of visitors who reached each depth" className="heat-side-card">
      <Async q={q} skeleton={<SkeletonRows rows={5} />} isEmpty={(d) => !d.sessions} compact empty={<EmptyState compact title="No scroll data for this page" />}>
        {(d) => (
          <>
            <ul className="scroll-levels">
              {d.levels
                .filter((l) => l.depth > 0)
                .map((l) => (
                  <li key={l.depth}>
                    <span className="scroll-depth-label">{l.depth}%</span>
                    <span className="scroll-track" aria-hidden="true">
                      <span style={{ width: `${l.pct}%`, opacity: 0.35 + (l.pct / 100) * 0.65 }} />
                    </span>
                    <span className="scroll-pct">{fmtPct(l.pct, 0)}</span>
                  </li>
                ))}
            </ul>
            <p className="muted small">
              {fmtNum(d.sessions)} sessions viewed this page. Bands on the left edge of the stage mark 25/50/75/100% of a typical {fmtNum(pageHeight)}px page.
            </p>
          </>
        )}
      </Async>
    </Card>
  );
}

function ScrollRuler({ levels, pageHeight, scale }) {
  if (!levels?.length || !pageHeight) return null;
  const marks = levels.filter((l) => l.depth > 0);
  return (
    <div className="scroll-ruler" aria-hidden="true">
      {marks.map((l, i) => {
        const top = ((i === 0 ? 0 : marks[i - 1].depth) / 100) * pageHeight * scale;
        const bottom = (l.depth / 100) * pageHeight * scale;
        return (
          <div key={l.depth} className="scroll-band" style={{ top, height: Math.max(bottom - top, 1), '--a': 0.1 + (l.pct / 100) * 0.6 }}>
            <span className="scroll-band-label">
              {l.depth}% · {fmtPct(l.pct, 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Heatmap() {
  const { range, device: globalDevice } = useFilters();
  const qf = useQueryFilters();
  // Layouts differ per breakpoint, so a heatmap always shows one device class (desktop when "All").
  const device = globalDevice || 'desktop';
  const f = useMemo(() => ({ ...qf, device }), [qf, device]);
  const href = useFilterHref();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') === 'rage_click' ? 'rage_click' : 'click';
  const mode = ['dots', 'heat', 'grid'].includes(params.get('mode')) ? params.get('mode') : 'heat';
  const [showPage, setShowPage] = useState(true);
  const [frameState, setFrameState] = useState('loading');

  const setParam = useCallback(
    (k, v, replace = false) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (v) n.set(k, v);
          else n.delete(k);
          return n;
        },
        { replace },
      ),
    [setParams],
  );

  const pagesQ = useApi('/api/pages', { range });
  const pages = pagesQ.data?.pages;
  const page = params.get('page') || '';

  // Pick the most-clicked page by default.
  useEffect(() => {
    if (!page && pages?.length) {
      const best = [...pages].sort((a, b) => (type === 'rage_click' ? b.rage_clicks - a.rage_clicks : b.clicks - a.clicks))[0];
      setParam('page', best.page_url, true);
    }
  }, [page, pages, type, setParam]);

  const current = pages?.find((p) => p.page_url === page);
  const heatQ = useApi('/api/heatmap', { page_url: page, type, ...f }, { enabled: Boolean(page) });
  const scrollQ = useApi('/api/stats/scroll', { page_url: page, ...f }, { enabled: Boolean(page) });

  const W = REF_WIDTH[device] || 1280;
  const clicks = heatQ.data?.clicks;

  const { points, H, pageHeight, sessions, topTargets } = useMemo(() => {
    const list = clicks || [];
    const pts = list.map((c) => {
      const pw = c.page_width || c.viewport_width;
      return { x: pw ? (c.x / pw) * W : Math.min(c.x, W), y: c.y, c };
    });
    const maxY = pts.reduce((m, p) => Math.max(m, p.y), 0);
    const heights = list.map((c) => c.page_height).filter(Boolean);
    const maxPH = heights.length ? Math.max(...heights) : 0;
    const height = Math.min(MAX_H, Math.max(Math.ceil(maxY + 24), maxPH, pts.length ? 0 : DEFAULT_H, 400));
    const counts = new Map();
    for (const c of list) {
      const k = c.target_label || c.target || '(unknown)';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return {
      points: pts,
      H: height,
      pageHeight: Math.min(MAX_H, median(heights) || height),
      sessions: new Set(list.map((c) => c.session_id)).size,
      topTargets: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [clicks, W]);

  const [viewportRef, containerWidth] = useElementWidth();
  const scale = containerWidth ? Math.min(1, containerWidth / W) : 1;
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (mode === 'dots') drawDots(canvas, points, W, H, { rage: type === 'rage_click' });
    else if (mode === 'grid') drawGrid(canvas, points, W, H);
    else drawHeat(canvas, points, W, H);
  }, [points, mode, W, H, type, containerWidth]);

  const src = previewUrl(current?.sample_url);
  useEffect(() => setFrameState('loading'), [src]);

  // Hover read-out: nearest click (dots/heat) or the cell count (grid).
  const [hover, setHover] = useState(null);
  const grid = useMemo(() => (mode === 'grid' ? gridCounts(points) : null), [mode, points]);
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (grid) {
      const v = grid.cells.get(`${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)}`);
      setHover(v ? { sx, sy, text: `${fmtNum(v)} ${type === 'rage_click' ? 'rage clicks' : 'clicks'} in this cell` } : null);
      return;
    }
    const thr = 10 / scale;
    let best = null;
    let bestD = thr * thr;
    for (const p of points) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setHover(best ? { sx, sy, text: best.c.target_label || best.c.target || 'Unknown element', sub: `${best.c.device || 'unknown'} · ${fmtRelative(best.c.timestamp)} · (${Math.round(best.c.x)}, ${Math.round(best.c.y)})` } : null);
  };

  const pageOptions = useMemo(() => {
    const list = pages || [];
    if (page && !list.some((p) => p.page_url === page)) return [{ page_url: page, page_group: page.replace(/^https?:\/\/[^/]+/, '') || page, clicks: 0, rage_clicks: 0, page_views: 0 }, ...list];
    return list;
  }, [pages, page]);

  if (pagesQ.error && !pages) return <div className="page"><Card><ErrorState error={pagesQ.error} onRetry={pagesQ.reload} /></Card></div>;

  return (
    <div className="page">
      <div className="heat-toolbar card">
        <label className="field">
          <span className="field-label">Page</span>
          {pages ? (
            <select className="select" value={page} onChange={(e) => setParam('page', e.target.value)} disabled={!pageOptions.length}>
              {!pageOptions.length && <option value="">No tracked pages</option>}
              {pageOptions.map((p) => (
                <option key={p.page_url} value={p.page_url}>
                  {p.page_group} — {fmtNum(type === 'rage_click' ? p.rage_clicks : p.clicks)} {type === 'rage_click' ? 'rage' : 'clicks'}
                </option>
              ))}
            </select>
          ) : (
            <Skeleton height={34} width={260} radius={8} />
          )}
        </label>
        <Segmented label="Event type" options={TYPE_OPTS} value={type} onChange={(v) => setParam('type', v === 'click' ? null : v)} size="sm" />
        <Segmented label="Display mode" options={MODE_OPTS} value={mode} onChange={(v) => setParam('mode', v)} size="sm" />
        <label className="switch">
          <input type="checkbox" checked={showPage} onChange={(e) => setShowPage(e.target.checked)} />
          <span className="switch-ui" aria-hidden="true" />
          <span>Show page underneath</span>
        </label>
      </div>

      <div className="heat-stats" aria-live="polite">
        {heatQ.data ? (
          <>
            <span><strong>{fmtNum(heatQ.data.count)}</strong> {type === 'rage_click' ? 'rage clicks' : 'clicks'}</span>
            <span><strong>{fmtNum(sessions)}</strong> sessions</span>
            <span className="muted">{device} layout · {W}px{!globalDevice ? ' (pick a device in the top bar to switch)' : ''}</span>
            {topTargets.length > 0 && (
              <span className="heat-top">
                <span className="muted">Top:</span>
                {topTargets.map(([label, n]) => (
                  <span key={label} className="chip" title={label}>
                    {label} <b>{fmtNum(n)}</b>
                  </span>
                ))}
              </span>
            )}
          </>
        ) : heatQ.error ? (
          <span className="text-bad">{heatQ.error.message}</span>
        ) : page ? (
          <Skeleton height={16} width={320} />
        ) : null}
        {current && (
          <Link className="link-more push-right" to={href(`/pages`)}>
            <Layers size={14} aria-hidden="true" /> {fmtNum(current.page_views)} views
          </Link>
        )}
      </div>

      <div className="heat-layout">
        <div className="heat-stage-col" ref={viewportRef}>
          {!page && pages && !pages.length ? (
            <Card><EmptyState icon={MousePointerClick} title="No tracked pages yet">Visit the store to start collecting clicks.</EmptyState></Card>
          ) : (
            <div className="heat-stage-outer" style={{ width: W * scale, height: H * scale }}>
              <div
                className={`heat-stage mode-${mode}`}
                style={{ width: W, height: H, transform: `scale(${scale})` }}
              >
                {showPage && src && (
                  <iframe
                    key={`${src}-${W}`}
                    title="Page preview"
                    src={src}
                    className={`heat-frame ${frameState === 'loaded' ? 'is-loaded' : ''}`}
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    tabIndex={-1}
                    aria-hidden="true"
                    width={W}
                    height={H}
                    onLoad={() => setFrameState('loaded')}
                  />
                )}
                <canvas ref={canvasRef} className={`heat-canvas ${mode === 'heat' ? 'is-heat' : ''}`} style={{ width: W, height: H }} />
              </div>
              <ScrollRuler levels={scrollQ.data?.levels} pageHeight={pageHeight} scale={scale} />
              <div className="heat-hit" onMouseMove={onMove} onMouseLeave={() => setHover(null)} aria-hidden="true">
                {hover && (
                  <div className="heat-tip" style={{ left: hover.sx, top: hover.sy }}>
                    <strong>{hover.text}</strong>
                    {hover.sub && <span>{hover.sub}</span>}
                  </div>
                )}
              </div>
              {heatQ.data && !heatQ.data.count && (
                <div className="heat-empty">
                  <EmptyState compact icon={type === 'rage_click' ? Flame : MousePointerClick} title={`No ${type === 'rage_click' ? 'rage clicks' : 'clicks'} on this page`}>
                    Try another page, device or a wider date range.
                  </EmptyState>
                </div>
              )}
              {heatQ.loading && !heatQ.data && <div className="heat-loading"><Skeleton height="100%" radius={0} /></div>}
            </div>
          )}
        </div>

        <aside className="heat-side" aria-label="Heatmap details">
          {mode === 'heat' && (
            <Card title="Intensity">
              <div className="heat-legend" style={{ background: HEAT_GRADIENT_CSS }} aria-hidden="true" />
              <div className="heat-legend-labels muted small"><span>Fewer</span><span>More clicks</span></div>
            </Card>
          )}
          <ScrollPanel q={scrollQ} pageHeight={pageHeight} />
          <Card title="About this view">
            <p className="muted small">
              X positions are normalised to a {W}px wide page so different screen sizes line up; Y is the document offset in px.
              Layouts that change between breakpoints are best viewed with a device filter.
            </p>
            {showPage && !src && <p className="muted small">No preview URL is available for this page.</p>}
            {current?.sample_url && (
              <p className="small">
                <a href={current.sample_url} target="_blank" rel="noopener noreferrer">Open page ↗</a>
              </p>
            )}
          </Card>
          {current && <p className="muted small"><PageGroup>{current.page_group}</PageGroup></p>}
        </aside>
      </div>
    </div>
  );
}
