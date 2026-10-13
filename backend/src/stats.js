import { Router } from 'express';
import { Event } from './models/Event.js';
import { parseRange, timeMatch, clampInt, deviceMatch } from './range.js';
import { normalizePageUrl } from './validate.js';

const router = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const ifType = (t) => ({ $cond: [{ $eq: ['$event_type', t] }, 1, 0] });
const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : 0);

/** Base $match for a request: date window + optional device. */
function baseMatch(req, which = 'current') {
  const r = parseRange(req.query);
  const m = which === 'previous' ? timeMatch(r.prevFrom, r.prevTo) : timeMatch(r.from, r.to);
  return { range: r, match: { ...m, ...deviceMatch(req.query) } };
}

async function overviewFor(match) {
  const [s] = await Event.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$session_id',
        first: { $min: '$timestamp' },
        last: { $max: '$timestamp' },
        pv: { $sum: ifType('page_view') },
        clicks: { $sum: ifType('click') },
        rage: { $sum: ifType('rage_click') },
        carts: { $sum: ifType('add_to_cart') },
        searches: { $sum: ifType('search') },
        orders: { $sum: ifType('purchase') },
        revenue: { $sum: { $cond: [{ $eq: ['$event_type', 'purchase'] }, { $ifNull: ['$props.value', 0] }, 0] } },
        events: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        events: { $sum: '$events' },
        page_views: { $sum: '$pv' },
        clicks: { $sum: '$clicks' },
        rage_clicks: { $sum: '$rage' },
        add_to_cart: { $sum: '$carts' },
        searches: { $sum: '$searches' },
        orders: { $sum: '$orders' },
        revenue: { $sum: '$revenue' },
        bounces: { $sum: { $cond: [{ $eq: ['$pv', 1] }, 1, 0] } },
        converted: { $sum: { $cond: [{ $gt: ['$orders', 0] }, 1, 0] } },
        duration: { $avg: { $subtract: ['$last', '$first'] } },
      },
    },
  ]);
  const o = s || {};
  const sessions = o.sessions || 0;
  return {
    sessions,
    events: o.events || 0,
    page_views: o.page_views || 0,
    clicks: o.clicks || 0,
    rage_clicks: o.rage_clicks || 0,
    add_to_cart: o.add_to_cart || 0,
    searches: o.searches || 0,
    orders: o.orders || 0,
    revenue: round(o.revenue || 0, 2),
    avg_order_value: o.orders ? round(o.revenue / o.orders, 2) : 0,
    avg_session_ms: Math.round(o.duration || 0),
    pages_per_session: sessions ? round(o.page_views / sessions, 2) : 0,
    bounce_rate: sessions ? round((o.bounces / sessions) * 100) : 0,
    conversion_rate: sessions ? round((o.converted / sessions) * 100, 2) : 0,
  };
}

/** GET /api/stats/overview — headline KPIs for the window and the previous window. */
router.get('/overview', wrap(async (req, res) => {
  const cur = baseMatch(req);
  const prev = baseMatch(req, 'previous');
  const [current, previous] = await Promise.all([
    overviewFor(cur.match),
    cur.range.prevFrom ? overviewFor(prev.match) : Promise.resolve(null),
  ]);
  res.json({ range: cur.range.label, from: cur.range.from, to: cur.range.to, current, previous });
}));

/** GET /api/stats/timeseries — buckets of sessions/page views/clicks/orders/revenue. */
router.get('/timeseries', wrap(async (req, res) => {
  const { range, match } = baseMatch(req);
  const span = range.from ? range.to - range.from : Infinity;
  const unit = req.query.interval === 'hour' || req.query.interval === 'day'
    ? req.query.interval
    : span <= 2 * 86400e3 ? 'hour' : 'day';

  const rows = await Event.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateTrunc: { date: '$timestamp', unit } },
        sessions: { $addToSet: '$session_id' },
        page_views: { $sum: ifType('page_view') },
        clicks: { $sum: ifType('click') },
        orders: { $sum: ifType('purchase') },
        revenue: { $sum: { $cond: [{ $eq: ['$event_type', 'purchase'] }, { $ifNull: ['$props.value', 0] }, 0] } },
      },
    },
    { $project: { _id: 0, t: '$_id', sessions: { $size: '$sessions' }, page_views: 1, clicks: 1, orders: 1, revenue: 1 } },
    { $sort: { t: 1 } },
  ]);

  // Fill empty buckets so charts have a continuous x axis.
  const step = unit === 'hour' ? 3600e3 : 86400e3;
  const byT = new Map(rows.map((r) => [new Date(r.t).getTime(), r]));
  const points = [];
  if (range.from && span / step <= 400) {
    const start = new Date(range.from);
    if (unit === 'hour') start.setUTCMinutes(0, 0, 0);
    else start.setUTCHours(0, 0, 0, 0);
    for (let t = start.getTime(); t <= range.to.getTime(); t += step) {
      const r = byT.get(t);
      points.push({ t: new Date(t), sessions: r?.sessions ?? 0, page_views: r?.page_views ?? 0, clicks: r?.clicks ?? 0, orders: r?.orders ?? 0, revenue: round(r?.revenue ?? 0, 2) });
    }
  } else {
    points.push(...rows.map((r) => ({ ...r, revenue: round(r.revenue, 2) })));
  }
  res.json({ interval: unit, points });
}));

const FUNNEL = [
  { key: 'page_view', label: 'Visited store' },
  { key: 'product_view', label: 'Viewed a product' },
  { key: 'add_to_cart', label: 'Added to cart' },
  { key: 'begin_checkout', label: 'Started checkout' },
  { key: 'purchase', label: 'Purchased' },
];

/** GET /api/stats/funnel — sessions reaching each step (and all previous steps). */
router.get('/funnel', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const groupFlags = Object.fromEntries(FUNNEL.map((s) => [s.key, { $max: ifType(s.key) }]));
  const rows = await Event.aggregate([
    { $match: { ...match, event_type: { $in: FUNNEL.map((s) => s.key) } } },
    { $group: { _id: '$session_id', ...groupFlags } },
  ]);

  const counts = FUNNEL.map(() => 0);
  for (const r of rows) {
    for (let i = 0; i < FUNNEL.length; i++) {
      if (!r[FUNNEL[i].key]) break;
      counts[i]++;
    }
  }
  const steps = FUNNEL.map((s, i) => ({
    ...s,
    sessions: counts[i],
    rate_from_start: counts[0] ? round((counts[i] / counts[0]) * 100) : 0,
    rate_from_prev: i === 0 ? 100 : counts[i - 1] ? round((counts[i] / counts[i - 1]) * 100) : 0,
    drop_off: i === 0 ? 0 : counts[i - 1] - counts[i],
  }));
  res.json({ steps });
}));

/** Ordered list of page groups per session (consecutive duplicates collapsed). */
async function sessionPaths(match, maxSessions = 20000) {
  const rows = await Event.aggregate([
    { $match: { ...match, event_type: 'page_view' } },
    { $sort: { session_id: 1, timestamp: 1 } },
    { $group: { _id: '$session_id', pages: { $push: '$page_group' }, last: { $max: '$timestamp' } } },
    { $sort: { last: -1 } }, // most recent sessions when capped
    { $limit: maxSessions },
  ]);
  return rows.map((r) => r.pages.filter((p, i, a) => i === 0 || a[i - 1] !== p));
}

/**
 * GET /api/stats/flows?steps=4 — navigation paths.
 * Returns a step-positioned (acyclic) Sankey graph plus a flat transition table.
 */
router.get('/flows', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const steps = clampInt(req.query.steps, 4, 2, 6);
  const paths = await sessionPaths(match);

  const linkCounts = new Map();
  const transitions = new Map();
  const EXIT = '(exit)';
  for (const p of paths) {
    for (let i = 0; i < p.length - 1; i++) {
      const k = `${p[i]}→${p[i + 1]}`;
      transitions.set(k, (transitions.get(k) || 0) + 1);
    }
    const capped = p.slice(0, steps);
    for (let i = 0; i < capped.length; i++) {
      const to = capped[i + 1] ?? (i < steps - 1 ? EXIT : null);
      if (!to) continue;
      const k = `${i}|${capped[i]}\u0000${i + 1}|${to}`;
      linkCounts.set(k, (linkCounts.get(k) || 0) + 1);
    }
  }

  // Keep the strongest links so the diagram stays readable.
  const top = [...linkCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, clampInt(req.query.links, 40, 5, 150));
  const nodeIndex = new Map();
  const nodes = [];
  const idx = (id) => {
    if (!nodeIndex.has(id)) {
      const [step, page] = [Number(id.split('|')[0]), id.slice(id.indexOf('|') + 1)];
      nodeIndex.set(id, nodes.length);
      nodes.push({ name: page, step });
    }
    return nodeIndex.get(id);
  };
  // Insert nodes ordered by step so the Sankey lays out left to right.
  top.sort((a, b) => Number(a[0].split('|')[0]) - Number(b[0].split('|')[0]));
  const links = top.map(([k, value]) => {
    const [from, to] = k.split('\u0000');
    return { source: idx(from), target: idx(to), value };
  });

  res.json({
    sessions: paths.length,
    nodes,
    links,
    transitions: [...transitions.entries()]
      .map(([k, count]) => {
        const [from, to] = k.split('→');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
  });
}));

/** GET /api/stats/pages — per-page engagement. */
router.get('/pages', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const [pages, scroll, paths] = await Promise.all([
    Event.aggregate([
      { $match: match },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: '$page_key',
          page_group: { $last: '$page_group' },
          sample_url: { $last: '$page_url' },
          views: { $sum: ifType('page_view') },
          clicks: { $sum: ifType('click') },
          rage_clicks: { $sum: ifType('rage_click') },
          sessions: { $addToSet: '$session_id' },
          time_total: { $sum: { $cond: [{ $eq: ['$event_type', 'time_on_page'] }, '$props.duration_ms', 0] } },
          time_n: { $sum: ifType('time_on_page') },
        },
      },
      { $match: { views: { $gt: 0 } } },
    ]),
    Event.aggregate([
      { $match: { ...match, event_type: 'scroll_depth' } },
      { $group: { _id: { k: '$page_key', s: '$session_id' }, max: { $max: '$props.depth' } } },
      { $group: { _id: '$_id.k', avg: { $avg: '$max' } } },
    ]),
    sessionPaths(match),
  ]);

  const scrollBy = new Map(scroll.map((s) => [s._id, s.avg]));
  const entries = new Map();
  const exits = new Map();
  for (const p of paths) {
    entries.set(p[0], (entries.get(p[0]) || 0) + 1);
    exits.set(p.at(-1), (exits.get(p.at(-1)) || 0) + 1);
  }
  const out = pages.map((p) => ({
    page_key: p._id,
    page_group: p.page_group,
    sample_url: p.sample_url,
    views: p.views,
    sessions: p.sessions.length,
    clicks: p.clicks,
    rage_clicks: p.rage_clicks,
    avg_time_ms: p.time_n ? Math.round(p.time_total / p.time_n) : 0,
    avg_scroll: round(scrollBy.get(p._id) || 0),
    entries: entries.get(p.page_group) || 0,
    exits: exits.get(p.page_group) || 0,
    exit_rate: p.views ? round(((exits.get(p.page_group) || 0) / p.views) * 100) : 0,
  }));
  out.sort((a, b) => b.views - a.views);
  res.json({ pages: out });
}));

/** GET /api/stats/clicks — most clicked elements and rage-click hotspots. */
router.get('/clicks', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const limit = clampInt(req.query.limit, 25, 1, 100);
  const label = { $ifNull: ['$target_label', { $ifNull: ['$target', '(unknown)'] }] };
  const topFor = (type) => Event.aggregate([
    { $match: { ...match, event_type: type } },
    {
      $group: {
        _id: { label, page: '$page_group' },
        count: { $sum: 1 },
        sessions: { $addToSet: '$session_id' },
        target: { $last: '$target' },
      },
    },
    { $project: { _id: 0, label: '$_id.label', page_group: '$_id.page', target: 1, count: 1, sessions: { $size: '$sessions' } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  const [top, rage, byPage] = await Promise.all([
    topFor('click'),
    topFor('rage_click'),
    Event.aggregate([
      { $match: { ...match, event_type: 'click' } },
      { $group: { _id: '$page_group', count: { $sum: 1 } } },
      { $project: { _id: 0, page_group: '$_id', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
  ]);
  res.json({ top, rage, by_page: byPage });
}));

/** GET /api/stats/search — search terms, zero-result searches. */
router.get('/search', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const [queries, [totals]] = await Promise.all([
    Event.aggregate([
      { $match: { ...match, event_type: 'search' } },
      {
        $group: {
          _id: '$props.query',
          count: { $sum: 1 },
          avg_results: { $avg: '$props.results' },
          zero: { $sum: { $cond: [{ $eq: ['$props.results', 0] }, 1, 0] } },
          sessions: { $addToSet: '$session_id' },
        },
      },
      { $project: { _id: 0, query: '$_id', count: 1, avg_results: { $round: ['$avg_results', 1] }, zero: 1, sessions: { $size: '$sessions' } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
    ]),
    Event.aggregate([
      { $match: { ...match, event_type: 'search' } },
      { $group: { _id: null, total: { $sum: 1 }, zero: { $sum: { $cond: [{ $eq: ['$props.results', 0] }, 1, 0] } }, sessions: { $addToSet: '$session_id' } } },
    ]),
  ]);
  res.json({
    total: totals?.total ?? 0,
    sessions: totals?.sessions.length ?? 0,
    unique_queries: queries.length,
    zero_result_rate: totals?.total ? round((totals.zero / totals.total) * 100) : 0,
    top: queries.slice(0, 25),
    zero_results: queries.filter((q) => q.zero > 0).sort((a, b) => b.zero - a.zero).slice(0, 15),
  });
}));

/** GET /api/stats/products — views → carts → purchases per product, plus categories. */
router.get('/products', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const [views, carts, sales] = await Promise.all([
    Event.aggregate([
      { $match: { ...match, event_type: 'product_view' } },
      { $group: { _id: '$props.product_id', views: { $sum: 1 }, name: { $last: '$props.product_name' }, category: { $last: '$props.category' }, price: { $last: '$props.price' } } },
    ]),
    Event.aggregate([
      { $match: { ...match, event_type: 'add_to_cart' } },
      { $group: { _id: '$props.product_id', adds: { $sum: 1 }, name: { $last: '$props.product_name' }, category: { $last: '$props.category' } } },
    ]),
    Event.aggregate([
      { $match: { ...match, event_type: 'purchase' } },
      { $unwind: '$props.items' },
      {
        $group: {
          _id: '$props.items.product_id',
          units: { $sum: { $ifNull: ['$props.items.quantity', 1] } },
          revenue: { $sum: { $multiply: [{ $ifNull: ['$props.items.price', 0] }, { $ifNull: ['$props.items.quantity', 1] }] } },
          name: { $last: '$props.items.name' },
          category: { $last: '$props.items.category' },
        },
      },
    ]),
  ]);

  const map = new Map();
  const get = (id, r) => {
    if (!map.has(id)) map.set(id, { product_id: id, name: r.name, category: r.category, price: r.price, views: 0, add_to_cart: 0, units_sold: 0, revenue: 0 });
    const p = map.get(id);
    p.name ??= r.name;
    p.category ??= r.category;
    p.price ??= r.price;
    return p;
  };
  for (const r of views) get(r._id, r).views = r.views;
  for (const r of carts) get(r._id, r).add_to_cart = r.adds;
  for (const r of sales) Object.assign(get(r._id, r), { units_sold: r.units, revenue: round(r.revenue, 2) });

  const products = [...map.values()].filter((p) => p.product_id).map((p) => ({
    ...p,
    view_to_cart: p.views ? round((p.add_to_cart / p.views) * 100) : 0,
    cart_to_purchase: p.add_to_cart ? Math.min(100, round((p.units_sold / p.add_to_cart) * 100)) : 0,
  }));

  const cats = new Map();
  for (const p of products) {
    const c = cats.get(p.category || 'other') || { category: p.category || 'other', views: 0, add_to_cart: 0, units_sold: 0, revenue: 0 };
    c.views += p.views;
    c.add_to_cart += p.add_to_cart;
    c.units_sold += p.units_sold;
    c.revenue = round(c.revenue + p.revenue, 2);
    cats.set(c.category, c);
  }

  const byViews = [...products].sort((a, b) => b.views - a.views);
  res.json({
    top_viewed: byViews.slice(0, 20),
    top_revenue: [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 20),
    // Lots of interest, few carts: candidates for better pricing/copy.
    low_conversion: byViews.filter((p) => p.views >= 5).sort((a, b) => a.view_to_cart - b.view_to_cart).slice(0, 10),
    categories: [...cats.values()].sort((a, b) => b.revenue - a.revenue || b.views - a.views),
  });
}));

function browserOf(ua = '') {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

/** GET /api/stats/devices — sessions by device class and browser. */
router.get('/devices', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  const rows = await Event.aggregate([
    { $match: { ...match, event_type: 'page_view' } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: '$session_id', device: { $first: '$device' }, ua: { $first: '$user_agent' } } },
  ]);
  const devices = {};
  const browsers = {};
  for (const r of rows) {
    const d = r.device || 'unknown';
    devices[d] = (devices[d] || 0) + 1;
    const b = browserOf(r.ua);
    browsers[b] = (browsers[b] || 0) + 1;
  }
  const toList = (o) => Object.entries(o).map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions);
  res.json({ devices: toList(devices), browsers: toList(browsers) });
}));

/** GET /api/stats/scroll?page_url= — how far visitors scrolled on a page. */
router.get('/scroll', wrap(async (req, res) => {
  const { match } = baseMatch(req);
  let pageKey;
  try {
    pageKey = normalizePageUrl(String(req.query.page_url || ''));
  } catch {
    return res.status(400).json({ error: 'page_url query parameter is required' });
  }
  const [rows, views] = await Promise.all([
    Event.aggregate([
      { $match: { ...match, page_key: pageKey, event_type: 'scroll_depth' } },
      { $group: { _id: '$session_id', max: { $max: '$props.depth' } } },
    ]),
    Event.aggregate([
      { $match: { ...match, page_key: pageKey, event_type: 'page_view' } },
      { $group: { _id: '$session_id' } },
      { $count: 'n' },
    ]),
  ]);
  const base = Math.max(views[0]?.n ?? 0, rows.length);
  const levels = [0, 25, 50, 75, 100].map((depth) => {
    const sessions = depth === 0 ? base : rows.filter((r) => r.max >= depth).length;
    return { depth, sessions, pct: base ? round((sessions / base) * 100) : 0 };
  });
  res.json({ page_url: pageKey, sessions: base, levels });
}));

export default router;
