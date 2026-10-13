import { Router } from 'express';
import { Event } from './models/Event.js';
import { validateEvent, extractBatch, normalizePageUrl, MAX_BATCH } from './validate.js';

const router = Router();

const clampInt = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
};

/**
 * POST /api/events
 * Body: single event, array of events, or { events: [...] }.
 * Accepts application/json and text/plain (navigator.sendBeacon).
 */
router.post('/events', async (req, res, next) => {
  try {
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
    if (batch.length > MAX_BATCH) {
      return res.status(413).json({ error: `max ${MAX_BATCH} events per request` });
    }

    const ua = req.get('user-agent');
    const valid = [];
    const errors = [];
    batch.forEach((raw, index) => {
      const { event, error } = validateEvent(raw, ua);
      if (error) errors.push({ index, error });
      else valid.push(event);
    });

    if (valid.length === 0) return res.status(400).json({ error: 'no valid events', errors });

    await Event.insertMany(valid, { ordered: false });
    res.status(201).json({ accepted: valid.length, rejected: errors.length, errors });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions?limit=50&skip=0
 * Lists sessions with event counts, most recent first.
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const limit = clampInt(req.query.limit, 50, 1, 500);
    const skip = clampInt(req.query.skip, 0, 0, Number.MAX_SAFE_INTEGER);

    const [result] = await Event.aggregate([
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: '$session_id',
          total_events: { $sum: 1 },
          page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
          pages: { $addToSet: '$page_key' },
          first_seen: { $first: '$timestamp' },
          last_seen: { $last: '$timestamp' },
          entry_page: { $first: '$page_url' },
        },
      },
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
                unique_pages: { $size: '$pages' },
                first_seen: 1,
                last_seen: 1,
                entry_page: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    res.json({
      total: result.total[0]?.count ?? 0,
      limit,
      skip,
      sessions: result.items,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions/:sessionId/events
 * All events for a session in chronological order (the user journey).
 */
router.get('/sessions/:sessionId/events', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const events = await Event.find({ session_id: sessionId })
      .sort({ timestamp: 1, _id: 1 })
      .select('-user_agent -__v')
      .lean();
    if (events.length === 0) return res.status(404).json({ error: 'session not found' });
    res.json({ session_id: sessionId, count: events.length, events });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/pages
 * Distinct pages that have been tracked, with click/view counts (for heatmap picker).
 */
router.get('/pages', async (_req, res, next) => {
  try {
    const pages = await Event.aggregate([
      {
        $group: {
          _id: '$page_key',
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
          page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
        },
      },
      { $sort: { clicks: -1, _id: 1 } },
      { $project: { _id: 0, page_url: '$_id', clicks: 1, page_views: 1 } },
    ]);
    res.json({ pages });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/heatmap?page_url=<url>
 * Click positions for a page. URL is normalised the same way as at ingest,
 * so query strings / trailing slashes don't split the data.
 */
router.get('/heatmap', async (req, res, next) => {
  try {
    const raw = req.query.page_url;
    if (typeof raw !== 'string' || !raw) {
      return res.status(400).json({ error: 'page_url query parameter is required' });
    }
    let pageKey;
    try {
      pageKey = normalizePageUrl(raw);
    } catch {
      return res.status(400).json({ error: 'invalid page_url' });
    }

    const clicks = await Event.find({ page_key: pageKey, event_type: 'click' })
      .sort({ timestamp: 1 })
      .select('-_id x y viewport_width viewport_height page_width page_height target timestamp session_id')
      .limit(20000)
      .lean();

    res.json({ page_url: pageKey, count: clicks.length, clicks });
  } catch (err) {
    next(err);
  }
});

export default router;
