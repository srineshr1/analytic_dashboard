// Canvas renderers for the heatmap stage. All coordinates are in reference px
// (already normalised to the stage width); the stage itself is CSS-scaled.

let paletteCache = null;

/** 256-entry RGB lookup: deep blue → cyan → green → yellow → red. */
export function heatPalette() {
  if (paletteCache) return paletteCache;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#1e3a8a');
  g.addColorStop(0.25, '#2563eb');
  g.addColorStop(0.45, '#06b6d4');
  g.addColorStop(0.6, '#22c55e');
  g.addColorStop(0.78, '#facc15');
  g.addColorStop(0.9, '#f97316');
  g.addColorStop(1, '#ef4444');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  paletteCache = ctx.getImageData(0, 0, 256, 1).data;
  return paletteCache;
}

export const HEAT_GRADIENT_CSS = 'linear-gradient(90deg, #1e3a8a, #2563eb 25%, #06b6d4 45%, #22c55e 60%, #facc15 78%, #f97316 90%, #ef4444)';

function setup(canvas, W, H, res) {
  canvas.width = Math.max(1, Math.round(W * res));
  canvas.height = Math.max(1, Math.round(H * res));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(res, 0, 0, res, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return ctx;
}

export function drawDots(canvas, points, W, H, { rage = false } = {}) {
  const ctx = setup(canvas, W, H, 1);
  const n = points.length;
  const alpha = n > 2000 ? 0.35 : n > 300 ? 0.5 : 0.7;
  const r = n > 2000 ? 3.5 : 5;
  ctx.fillStyle = rage ? `rgba(248, 113, 113, ${alpha})` : `rgba(129, 140, 248, ${alpha})`;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (n <= 600) ctx.stroke();
  }
}

/**
 * Density heatmap: accumulate soft radial gradients into the alpha channel of a
 * half-resolution canvas, normalise to the hottest pixel, then colourise.
 */
export function drawHeat(canvas, points, W, H, { radius = 26 } = {}) {
  const res = 0.5;
  const ctx = setup(canvas, W, H, res);
  if (!points.length) return;
  const n = points.length;
  const a = Math.min(0.35, Math.max(0.02, 3 / Math.sqrt(n)));
  for (const p of points) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  }
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let max = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i];
  if (!max) return;
  const pal = heatPalette();
  const k = 255 / max;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(255, Math.round(d[i + 3] * k));
    if (v < 3) {
      d[i + 3] = 0;
      continue;
    }
    d[i] = pal[v * 4];
    d[i + 1] = pal[v * 4 + 1];
    d[i + 2] = pal[v * 4 + 2];
    d[i + 3] = Math.min(235, 50 + v * 0.75);
  }
  ctx.putImageData(img, 0, 0);
}

export const GRID_CELL = 40;

/** Bucket counts on a GRID_CELL grid. Returns { cells: Map<"cx,cy", n>, max }. */
export function gridCounts(points) {
  const cells = new Map();
  let max = 0;
  for (const p of points) {
    const k = `${Math.floor(p.x / GRID_CELL)},${Math.floor(p.y / GRID_CELL)}`;
    const v = (cells.get(k) || 0) + 1;
    cells.set(k, v);
    if (v > max) max = v;
  }
  return { cells, max };
}

export function drawGrid(canvas, points, W, H) {
  const ctx = setup(canvas, W, H, 1);
  const { cells, max } = gridCounts(points);
  const pal = heatPalette();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += GRID_CELL) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += GRID_CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [k, v] of cells) {
    const [cx, cy] = k.split(',').map(Number);
    const t = max > 1 ? Math.log(v) / Math.log(max) : 1; // log scale keeps small cells visible
    const idx = Math.round(40 + t * 215) * 4;
    ctx.fillStyle = `rgba(${pal[idx]}, ${pal[idx + 1]}, ${pal[idx + 2]}, ${0.35 + t * 0.4})`;
    ctx.fillRect(cx * GRID_CELL + 1, cy * GRID_CELL + 1, GRID_CELL - 2, GRID_CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(v > 999 ? `${Math.round(v / 100) / 10}k` : String(v), cx * GRID_CELL + GRID_CELL / 2, cy * GRID_CELL + GRID_CELL / 2);
  }
}
