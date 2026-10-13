import { Router } from 'express';
import { Event } from './models/Event.js';
import { validateEvent, extractBatch, normalizePageUrl, MAX_BATCH } from './validate.js';
import { parseRange, timeMatch, clampInt, deviceMatch } from './range.js';
import stats from './stats.js';

const router = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const ifType = (t) => ({ $cond: [{ $eq: ['$event_type', t] }, 1, 0] });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * POST /api/events
 * Body: single event, array of events, or { events: [...] }.
 * Accepts application/json and text/plain (navigator.sendBeacon).
 */
router.post('/events', wrap(async (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'body is not valid JSON' });
    }
  }

  const batch = extractBatch(body);
  if (!batch || batch.length === 0) return res.status(400).json({ error: 'no events provided' });
  if (batch.length > MAX_BATCH) return res.status(413).json({ error: `max ${MAX_BATCH} events per request` });

  const ua = req.get('user-agent');
  const valid = [];
  const errors = [];
  batch.forEach((raw, index) => {
    const { event, error } = validateEvent(raw, ua);
    if (error) errors.push({ index, error });
    else valid.push(event);
  });

  if (valid.length === 0) return res.status(400).json({ error: 'no valid events', errors });

  let inserted;
  try {
    inserted = (await Event.insertMany(valid, { ordered: false })).length;
  } catch (err) {
    // Partial failure (e.g. schema validation): report what was actually stored.
    if (!Array.isArray(err.insertedDocs)) throw err;
    inserted = err.insertedDocs.length;
  }
  const failed = valid.length - inserted;
  if (failed) errors.push({ index: -1, error: `${failed} event(s) failed schema validation` });
  if (!inserted) return res.status(400).json({ error: 'no valid events', errors });
  res.status(201).json({ accepted: inserted, rejected: batch.length - inserted, errors });
}));

/**
 * GET /api/sessions?limit=50&skip=0&range=all&device=&q=&converted=1
 * Lists sessions with event counts, most recent first.
 */
router.get('/sessions', wrap(async (req, res) => {
  const limit = clampInt(req.query.limit, 50, 1, 500);
  const skip = clampInt(req.query.skip, 0, 0, Number.MAX_SAFE_INTEGER);
  const r = parseRange(req.query, 'all');
  const match = { ...timeMatch(r.from, r.to) };
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    match.session_id = { $regex: `^${escapeRe(req.query.q.trim().slice(0, 64))}` };
  }

  const post = [];
  if (deviceMatch(req.query).device) post.push({ $match: { device: req.query.device } });
  if (req.query.converted === '1') post.push({ $match: { orders: { $gt: 0 } } });

  const [result] = await Event.aggregate([
    { $match: match },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: '$session_id',
        total_events: { $sum: 1 },
        page_views: { $sum: ifType('page_view') },
        clicks: { $sum: ifType('click') },
        rage_clicks: { $sum: ifType('rage_click') },
        add_to_cart: { $sum: ifType('add_to_cart') },
        orders: { $sum: ifType('purchase') },
        revenue: { $sum: { $cond: [{ $eq: ['$event_type', 'purchase'] }, { $ifNull: ['$props.value', 0] }, 0] } },
        pages: { $addToSet: '$page_key' },
        first_seen: { $first: '$timestamp' },
        last_seen: { $last: '$timestamp' },
        entry_page: { $first: '$page_url' },
        exit_page: { $last: '$page_url' },
        device: { $first: '$device' },
      },
    },
    ...post,
    { $sort: { last_seen: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              session_id: '$_id',
              total_events: 1,
              page_views: 1,
              clicks: 1,
              rage_clicks: 1,
              add_to_cart: 1,
              orders: 1,
              revenue: { $round: ['$revenue', 2] },
              unique_pages: { $size: '$pages' },
              first_seen: 1,
              last_seen: 1,
              duration_ms: { $subtract: ['$last_seen', '$first_seen'] },
              entry_page: 1,
              exit_page: 1,
              device: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  res.json({ total: result.total[0]?.count ?? 0, limit, skip, sessions: result.items });
}));

/**
 * GET /api/sessions/:sessionId/events
 * All events for a session in chronological order (the user journey).
 */
router.get('/sessions/:sessionId/events', wrap(async (req, res) => {
  const { sessionId } = req.params;
  const events = await Event.find({ session_id: sessionId })
    .sort({ timestamp: 1, _id: 1 })
    .select('-user_agent')
    .lean();
  if (events.length === 0) return res.status(404).json({ error: 'session not found' });
  res.json({ session_id: sessionId, count: events.length, events });
}));

/**
 * GET /api/pages?range=all
 * Tracked pages (page groups) with click/view counts and a sample URL for previews.
 */
router.get('/pages', wrap(async (req, res) => {
  const r = parseRange(req.query, 'all');
  const pages = await Event.aggregate([
    { $match: timeMatch(r.from, r.to) },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: '$page_key',
        page_group: { $last: '$page_group' },
        sample_url: { $last: '$page_url' },
        clicks: { $sum: ifType('click') },
        rage_clicks: { $sum: ifType('rage_click') },
        page_views: { $sum: ifType('page_view') },
      },
    },
    { $sort: { clicks: -1, _id: 1 } },
    { $project: { _id: 0, page_url: '$_id', page_group: 1, sample_url: 1, clicks: 1, rage_clicks: 1, page_views: 1 } },
  ]);
  res.json({ pages });
}));

/**
 * GET /api/heatmap?page_url=<url>&range=&device=&type=click|rage_click
 * Click positions for a page. The URL is normalised the same way as at ingest,
 * so query strings / trailing slashes don't split the data. Grouped pages are
 * addressed by their page key, e.g. https://shop.test/store/product/:id
 */
router.get('/heatmap', wrap(async (req, res) => {
  const raw = req.query.page_url;
  if (typeof raw !== 'string' || !raw) return res.status(400).json({ error: 'page_url query parameter is required' });
  let pageKey;
  try {
    pageKey = normalizePageUrl(raw);
  } catch {
    return res.status(400).json({ error: 'invalid page_url' });
  }
  const r = parseRange(req.query, 'all');
  const type = req.query.type === 'rage_click' ? 'rage_click' : 'click';

  const clicks = await Event.find({ page_key: pageKey, event_type: type, ...timeMatch(r.from, r.to), ...deviceMatch(req.query) })
    .sort({ timestamp: -1 }) // newest first, so the cap keeps recent clicks
    .select('-_id x y page_width page_height target target_label device timestamp session_id')
    .limit(20000)
    .lean();

  res.json({ page_url: pageKey, count: clicks.length, clicks });
}));

/**
 * GET /api/live — most recent events and currently active sessions (last 5 minutes).
 */
router.get('/live', wrap(async (req, res) => {
  const since = new Date(Date.now() - 5 * 60e3);
  const limit = clampInt(req.query.limit, 50, 1, 200);
  const [recent, active, perMin] = await Promise.all([
    Event.find({})
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .select('session_id event_type page_group page_url target_label props device timestamp')
      .lean(),
    Event.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: '$session_id', last_page: { $last: '$page_group' }, last_seen: { $last: '$timestamp' }, events: { $sum: 1 }, device: { $last: '$device' } } },
      { $sort: { last_seen: -1 } },
      { $facet: { items: [{ $limit: 50 }], total: [{ $count: 'n' }] } },
    ]),
    Event.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 60e3) } } },
      { $group: { _id: { $dateTrunc: { date: '$timestamp', unit: 'minute' } }, events: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, t: '$_id', events: 1 } },
    ]),
  ]);
  const [{ items: activeList, total }] = active;
  res.json({
    active_sessions: total[0]?.n ?? 0,
    sessions: activeList.map((a) => ({ session_id: a._id, last_page: a.last_page, last_seen: a.last_seen, events: a.events, device: a.device })),
    events_per_minute: perMin,
    recent,
  });
}));

router.use('/stats', stats);

export default router;
