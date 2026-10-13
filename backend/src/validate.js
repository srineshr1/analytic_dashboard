import { EVENT_TYPES } from './models/Event.js';

export const MAX_BATCH = 100;
// Accepted clock skew for client timestamps. The seeder generates history, so it passes { checkSkew: false }.
const MAX_FUTURE_MS = 5 * 60e3;
const MAX_PAST_MS = 7 * 86400e3;
const SESSION_RE = /^[A-Za-z0-9_-]{8,128}$/;
const GROUP_RE = /^\/[A-Za-z0-9._~:\/-]{0,511}$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v, min = -Infinity, max = Infinity) => (isNum(v) && v >= min && v <= max ? v : undefined);
const optStr = (v, max) => (typeof v === 'string' && v.trim().length ? v.trim().slice(0, max) : undefined);
const optId = (v) => (typeof v === 'string' || isNum(v) ? String(v).slice(0, 64) : undefined);

const stripSlash = (p) => p.replace(/\/+$/, '') || '/';

/** origin + pathname, trailing slash stripped (except root). Only http(s). */
export function normalizePageUrl(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported protocol');
  return `${u.origin}${stripSlash(u.pathname)}`;
}

/** Splits a page_key back into { origin, group }. */
export function pageKeyFor(pageUrl, pageGroup) {
  const u = new URL(pageUrl);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported protocol');
  const group = pageGroup && GROUP_RE.test(pageGroup) ? stripSlash(pageGroup) : stripSlash(u.pathname);
  return { page_key: `${u.origin}${group}`, page_group: group };
}

export function deviceFor(viewportWidth) {
  if (!isNum(viewportWidth)) return undefined;
  if (viewportWidth < 768) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}

function cleanItems(items) {
  if (!Array.isArray(items)) return undefined;
  return items.slice(0, 50).flatMap((it) => {
    if (!it || typeof it !== 'object') return [];
    const product_id = optId(it.product_id);
    if (!product_id) return [];
    return [{
      product_id,
      name: optStr(it.name, 200),
      category: optStr(it.category, 64),
      price: optNum(it.price, 0, 1e7),
      quantity: optNum(it.quantity, 0, 1000),
    }];
  });
}

function cleanProps(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
  const out = {
    product_id: optId(p.product_id),
    product_name: optStr(p.product_name, 200),
    category: optStr(p.category, 64),
    brand: optStr(p.brand, 64),
    price: optNum(p.price, 0, 1e7),
    quantity: optNum(p.quantity, 0, 1000),
    query: optStr(p.query, 200)?.toLowerCase(),
    results: optNum(p.results, 0, 1e6),
    value: optNum(p.value, 0, 1e9),
    items_count: optNum(p.items_count, 0, 10000),
    items: cleanItems(p.items),
    order_id: optStr(p.order_id, 64),
    depth: optNum(p.depth, 0, 100),
    duration_ms: optNum(p.duration_ms, 0, 24 * 3600 * 1000),
    count: optNum(p.count, 0, 1000),
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

// Per-type requirements on props (after cleaning).
const REQUIRED_PROPS = {
  scroll_depth: ['depth'],
  time_on_page: ['duration_ms'],
  product_view: ['product_id'],
  add_to_cart: ['product_id'],
  remove_from_cart: ['product_id'],
  search: ['query'],
  purchase: ['value'],
};

/**
 * Validate one raw event. Returns { event } on success or { error } on failure.
 * Unknown fields are dropped.
 */
export function validateEvent(raw, userAgent, { checkSkew = true } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'event must be an object' };

  const { session_id, event_type, page_url, timestamp } = raw;

  if (typeof session_id !== 'string' || !SESSION_RE.test(session_id)) return { error: 'invalid session_id' };
  if (!EVENT_TYPES.includes(event_type)) return { error: `event_type must be one of ${EVENT_TYPES.join(', ')}` };
  if (typeof page_url !== 'string' || page_url.length > 2048) return { error: 'invalid page_url' };

  let keys;
  try {
    keys = pageKeyFor(page_url, typeof raw.page_group === 'string' ? raw.page_group : undefined);
  } catch {
    return { error: 'invalid page_url' };
  }

  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') return { error: 'invalid timestamp' };
  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) return { error: 'invalid timestamp' };
  // Public ingest: don't let clients write far into the past or future (keeps Live/session order honest).
  const skew = ts.getTime() - Date.now();
  if (checkSkew && (skew > MAX_FUTURE_MS || skew < -MAX_PAST_MS)) return { error: 'timestamp out of range' };
  if (keys.page_key.length > 2048 || keys.page_group.length > 512) return { error: 'page_url too long' };

  const viewport_width = optNum(raw.viewport_width, 0, 100000);
  const event = {
    session_id,
    event_type,
    page_url,
    ...keys,
    timestamp: ts,
    viewport_width,
    viewport_height: optNum(raw.viewport_height, 0, 100000),
    page_width: optNum(raw.page_width, 0, 100000),
    page_height: optNum(raw.page_height, 0, 1000000),
    device: deviceFor(viewport_width),
    referrer: optStr(raw.referrer, 2048),
    user_agent: optStr(userAgent, 512),
  };

  if (event_type === 'click' || event_type === 'rage_click') {
    if (!isNum(raw.x) || !isNum(raw.y) || raw.x < 0 || raw.y < 0) {
      return { error: `${event_type} events require non-negative numeric x and y` };
    }
    event.x = raw.x;
    event.y = raw.y;
    event.target = optStr(raw.target, 256);
    event.target_label = optStr(raw.target_label, 128);
  }

  const props = cleanProps(raw.props);
  for (const key of REQUIRED_PROPS[event_type] || []) {
    if (props[key] === undefined) return { error: `${event_type} events require props.${key}` };
  }
  if (Object.keys(props).length) event.props = props;

  for (const k of Object.keys(event)) if (event[k] === undefined) delete event[k];
  return { event };
}

/** Accepts a single event, an array, or { events: [...] }. */
export function extractBatch(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.events)) return body.events;
  if (body && typeof body === 'object') return [body];
  return null;
}
