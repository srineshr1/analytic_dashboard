import { EVENT_TYPES } from './models/Event.js';

const MAX_BATCH = 100;
const SESSION_RE = /^[A-Za-z0-9_-]{8,128}$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v) => (isNum(v) ? v : undefined);
const optStr = (v, max) => (typeof v === 'string' && v.length ? v.slice(0, max) : undefined);

/** origin + pathname, trailing slash stripped (except root). */
export function normalizePageUrl(raw) {
  const u = new URL(raw);
  let path = u.pathname.replace(/\/+$/, '') || '/';
  return `${u.origin}${path}`;
}

/**
 * Validate one raw event. Returns { event } on success or { error } on failure.
 * Unknown fields are dropped.
 */
export function validateEvent(raw, userAgent) {
  if (!raw || typeof raw !== 'object') return { error: 'event must be an object' };

  const { session_id, event_type, page_url, timestamp } = raw;

  if (typeof session_id !== 'string' || !SESSION_RE.test(session_id)) {
    return { error: 'invalid session_id' };
  }
  if (!EVENT_TYPES.includes(event_type)) {
    return { error: `event_type must be one of ${EVENT_TYPES.join(', ')}` };
  }
  if (typeof page_url !== 'string' || page_url.length > 2048) {
    return { error: 'invalid page_url' };
  }
  let page_key;
  try {
    page_key = normalizePageUrl(page_url);
  } catch {
    return { error: 'invalid page_url' };
  }

  const ts = new Date(timestamp);
  if (timestamp == null || Number.isNaN(ts.getTime())) {
    return { error: 'invalid timestamp' };
  }

  const event = {
    session_id,
    event_type,
    page_url,
    page_key,
    timestamp: ts,
    viewport_width: optNum(raw.viewport_width),
    viewport_height: optNum(raw.viewport_height),
    page_width: optNum(raw.page_width),
    page_height: optNum(raw.page_height),
    referrer: optStr(raw.referrer, 2048),
    user_agent: optStr(userAgent, 512),
  };

  if (event_type === 'click') {
    if (!isNum(raw.x) || !isNum(raw.y) || raw.x < 0 || raw.y < 0) {
      return { error: 'click events require non-negative numeric x and y' };
    }
    event.x = raw.x;
    event.y = raw.y;
    event.target = optStr(raw.target, 256);
  }

  return { event };
}

/** Accepts a single event, an array, or { events: [...] }. */
export function extractBatch(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.events)) return body.events;
  if (body && typeof body === 'object') return [body];
  return null;
}

export { MAX_BATCH };
