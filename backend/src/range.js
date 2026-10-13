// Date-range parsing shared by the analytics endpoints.
const RANGES = { '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3, '90d': 90 * 86400e3 };

/**
 * Reads ?range=24h|7d|30d|90d|all or ?from=&to= (ISO dates).
 * Returns { from, to, prevFrom, prevTo } (Dates; from/prevFrom null for "all").
 */
export function parseRange(query, def = '7d') {
  const now = new Date();
  const fromQ = query.from ? new Date(query.from) : null;
  const toQ = query.to ? new Date(query.to) : null;

  if (fromQ && !Number.isNaN(fromQ.getTime())) {
    const to = toQ && !Number.isNaN(toQ.getTime()) ? toQ : now;
    const len = to - fromQ;
    return { from: fromQ, to, prevFrom: new Date(fromQ - len), prevTo: fromQ, label: 'custom' };
  }

  const key = typeof query.range === 'string' ? query.range : def;
  if (key === 'all') return { from: null, to: now, prevFrom: null, prevTo: null, label: 'all' };
  const len = RANGES[key] ?? RANGES[def];
  const from = new Date(now - len);
  return { from, to: now, prevFrom: new Date(from - len), prevTo: from, label: RANGES[key] ? key : def };
}

/** Mongo $match on timestamp for a [from, to] window. */
export function timeMatch(from, to) {
  const t = {};
  if (from) t.$gte = from;
  if (to) t.$lte = to;
  return Object.keys(t).length ? { timestamp: t } : {};
}

export const clampInt = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
};

/** Optional ?device=desktop|tablet|mobile filter. */
export function deviceMatch(query) {
  return ['desktop', 'tablet', 'mobile'].includes(query.device) ? { device: query.device } : {};
}
