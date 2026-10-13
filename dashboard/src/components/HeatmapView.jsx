import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAsync, shortUrl } from '../util.js';

// Clicks are bucketed by the visitor's viewport width, then drawn on a
// reference canvas of that device's typical width.
const DEVICES = {
  all: { label: 'All devices', min: 0, max: Infinity, width: 1280 },
  desktop: { label: 'Desktop (≥1024px)', min: 1024, max: Infinity, width: 1280 },
  tablet: { label: 'Tablet (768–1023px)', min: 768, max: 1023, width: 820 },
  mobile: { label: 'Mobile (<768px)', min: 0, max: 767, width: 390 },
};
const GRID = 40; // px per grid cell on the reference canvas

// Callback ref so it works for elements that mount after the first render.
function useElementWidth() {
  const [el, setEl] = useState(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

function withPreviewFlag(url) {
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set('ua_preview', '1');
    return u.href;
  } catch {
    return null;
  }
}

export default function HeatmapView({ page }) {
  const pages = useAsync(() => api.pages(), []);
  const [device, setDevice] = useState('all');
  const [mode, setMode] = useState('dots');
  const [showPage, setShowPage] = useState(true);

  // Default to the most-clicked page once the list loads.
  const pageList = pages.data?.pages ?? [];
  const selected = page || pageList[0]?.page_url || '';

  const heat = useAsync(() => (selected ? api.heatmap(selected) : Promise.resolve(null)), [selected]);
  const [wrapRef, wrapWidth] = useElementWidth();

  const dev = DEVICES[device];
  const refW = dev.width;

  const { points, height, sessions, topTargets } = useMemo(() => {
    const clicks = (heat.data?.clicks ?? []).filter((c) => {
      const vw = c.viewport_width ?? c.page_width ?? refW;
      return vw >= dev.min && vw <= dev.max;
    });
    const pts = clicks.map((c) => ({
      // x is stored in the visitor's document px; normalise to the reference width.
      x: (c.x / (c.page_width || refW)) * refW,
      y: c.y,
      target: c.target,
    }));
    const maxY = pts.reduce((m, p) => Math.max(m, p.y), 0);
    const maxPageH = clicks.reduce((m, c) => Math.max(m, c.page_height || 0), 0);
    const h = Math.min(Math.max(600, maxY + GRID, maxPageH), 12000);

    const targets = new Map();
    for (const c of clicks) if (c.target) targets.set(c.target, (targets.get(c.target) || 0) + 1);

    return {
      points: pts,
      height: h,
      sessions: new Set(clicks.map((c) => c.session_id)).size,
      topTargets: [...targets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [heat.data, dev, refW]);

  const grid = useMemo(() => {
    if (mode !== 'grid') return { cells: [], max: 0 };
    const m = new Map();
    for (const p of points) {
      const key = `${Math.floor(p.x / GRID)}:${Math.floor(p.y / GRID)}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    let max = 0;
    const cells = [...m.entries()].map(([k, n]) => {
      const [cx, cy] = k.split(':').map(Number);
      max = Math.max(max, n);
      return { cx, cy, n };
    });
    return { cells, max };
  }, [points, mode]);

  const scale = wrapWidth ? Math.min(1, wrapWidth / refW) : 1;
  const previewSrc = selected ? withPreviewFlag(selected) : null;

  const selectPage = (url) => {
    window.location.hash = `#/heatmap?page=${encodeURIComponent(url)}`;
  };

  return (
    <section className="panel" aria-labelledby="heatmap-title">
      <div className="panel-head">
        <h2 id="heatmap-title">Click heatmap</h2>
        <button className="btn" onClick={() => { pages.reload(); heat.reload(); }}>Refresh</button>
      </div>

      {pages.error && <p className="error" role="alert">Failed to load pages: {pages.error.message}</p>}
      {!pages.loading && pageList.length === 0 && <p className="empty">No tracked pages yet.</p>}

      {pageList.length > 0 && (
        <div className="controls">
          <label>
            Page
            <select value={selected} onChange={(e) => selectPage(e.target.value)}>
              {!pageList.some((p) => p.page_url === selected) && selected && <option value={selected}>{selected}</option>}
              {pageList.map((p) => (
                <option key={p.page_url} value={p.page_url}>
                  {shortUrl(p.page_url)} — {p.clicks} clicks
                </option>
              ))}
            </select>
          </label>
          <label>
            Device
            <select value={device} onChange={(e) => setDevice(e.target.value)}>
              {Object.entries(DEVICES).map(([k, d]) => (
                <option key={k} value={k}>{d.label}</option>
              ))}
            </select>
          </label>
          <fieldset className="segmented">
            <legend className="sr-only">Display mode</legend>
            {['dots', 'grid'].map((m) => (
              <label key={m} className={mode === m ? 'on' : ''}>
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                {m === 'dots' ? 'Dots' : 'Grid'}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={showPage} onChange={(e) => setShowPage(e.target.checked)} />
            Show page underneath
          </label>
        </div>
      )}

      {heat.error && <p className="error" role="alert">{heat.error.message}</p>}

      {selected && heat.data && (
        <>
          <p className="stats">
            <strong>{points.length}</strong> clicks from <strong>{sessions}</strong> sessions
            {topTargets.length > 0 && (
              <span className="muted">
                {' '}· top elements:{' '}
                {topTargets.map(([t, n], i) => (
                  <span key={t}>{i > 0 && ', '}<code>{t}</code> ({n})</span>
                ))}
              </span>
            )}
          </p>

          <div ref={wrapRef} className="heatmap-wrap" style={{ height: height * scale }}>
            <div
              className="heatmap-stage"
              style={{ width: refW, height, transform: `scale(${scale})` }}
              role="img"
              aria-label={`${points.length} clicks plotted on ${shortUrl(selected)}`}
            >
              {showPage && previewSrc && (
                <iframe
                  title="Page preview"
                  src={previewSrc}
                  width={refW}
                  height={height}
                  tabIndex={-1}
                  sandbox="allow-scripts"
                />
              )}
              <svg width={refW} height={height} className="overlay">
                {mode === 'dots' &&
                  points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={7} className="dot">
                      {p.target && <title>{p.target}</title>}
                    </circle>
                  ))}
                {mode === 'grid' &&
                  grid.cells.map(({ cx, cy, n }) => (
                    <rect
                      key={`${cx}:${cy}`}
                      x={cx * GRID}
                      y={cy * GRID}
                      width={GRID}
                      height={GRID}
                      className="cell"
                      style={{ fillOpacity: 0.15 + 0.7 * (n / grid.max) }}
                    >
                      <title>{n} clicks</title>
                    </rect>
                  ))}
              </svg>
            </div>
          </div>
          {points.length === 0 && <p className="empty">No clicks recorded for this page/device.</p>}
        </>
      )}
    </section>
  );
}
