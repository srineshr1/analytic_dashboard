// Number, currency, percent, duration and time formatting helpers.
const nf = new Intl.NumberFormat('en-US');
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const compactNf = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const fmtNum = (v) => nf.format(num(v));
export const fmtDec = (v) => nf1.format(num(v));
export const fmtCompact = (v) => (Math.abs(num(v)) < 10000 ? nf.format(num(v)) : compactNf.format(num(v)));

/** $1,204.50 — whole dollars when the amount is large or integral. */
export function fmtCurrency(v, { compact = false } = {}) {
  const n = num(v);
  if (compact && Math.abs(n) >= 10000) return usdCompact.format(n);
  if (Number.isInteger(n) || Math.abs(n) >= 1000) return usd0.format(n);
  return usd.format(n);
}

/** Percent from a 0–100 value: 12.3% */
export const fmtPct = (v, digits = 1) => `${num(v).toFixed(digits).replace(/\.0+$/, '')}%`;

/** Duration in ms → "2m 14s", "1h 05m", "8s", "0s". */
export function fmtDuration(ms) {
  const total = Math.round(num(ms) / 1000);
  if (total <= 0) return '0s';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Offset from session start: "+1m 03s". */
export const fmtOffset = (ms) => `+${fmtDuration(ms)}`;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "3 min ago", "yesterday", … */
export function fmtRelative(date, now = Date.now()) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 10) return 'just now';
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 30 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(date);
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export const fmtDate = (d) => dateFmt.format(new Date(d));
export const fmtDateTime = (d) => dateTimeFmt.format(new Date(d));
export const fmtTime = (d) => timeFmt.format(new Date(d));
export const fmtHour = (d) => hourFmt.format(new Date(d));
export const fmtDay = (d) => dayFmt.format(new Date(d));

/** % change between two values; null when there's no baseline. */
export function pctChange(cur, prev) {
  if (prev === null || prev === undefined) return null;
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export const shortId = (id = '') => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

/** Path part of a URL (or the input if it isn't one). */
export function pathOf(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url || '';
  }
}

/** "1 item" / "3 items" */
export const plural = (n, word, pluralWord = `${word}s`) => `${fmtNum(n)} ${n === 1 ? word : pluralWord}`;
