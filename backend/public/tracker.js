/*!
 * Lightweight analytics tracker (v2).
 *
 * Usage:
 *   <script src="https://your-api.example.com/tracker.js" defer
 *           data-page-groups="/store/product/:id,/store/category/:slug"></script>
 *
 * Optional attributes:
 *   data-endpoint     where to POST events (default: <script origin>/api/events)
 *   data-page-groups  comma-separated path patterns; ":name" matches one segment, "*" the rest.
 *                     Pages matching a pattern are grouped (e.g. all product pages share one heatmap).
 *   data-debug        log events to the console
 *
 * Automatic events: page_view (incl. SPA navigation), click, rage_click, scroll_depth, time_on_page.
 * Custom events:    Tracker.track('add_to_cart', { product_id: '12', price: 9.99 })
 * Name elements for reports with data-track="add-to-cart".
 *
 * window.Tracker = { track, flush, getSessionId }
 */
(function () {
  'use strict';
  if (window.Tracker) return; // already loaded

  // Dashboard heatmap previews load pages with ?ua_preview=1: expose a no-op API, record nothing.
  if (/[?&]ua_preview=1(&|$)/.test(location.search)) {
    var noop = function () {};
    window.Tracker = { track: noop, flush: noop, getSessionId: function () { return 'preview'; }, preview: true };
    return;
  }

  var script = document.currentScript;
  var attr = function (n) { return script ? script.getAttribute(n) : null; };
  var ENDPOINT = attr('data-endpoint') || (script && script.src ? new URL('/api/events', script.src).href : '/api/events');
  var DEBUG = !!(script && script.hasAttribute('data-debug'));
  var GROUPS = (attr('data-page-groups') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  var SESSION_KEY = 'ua_session';
  var SESSION_TTL_MS = 30 * 60 * 1000; // new session after 30 min of inactivity
  var FLUSH_INTERVAL_MS = 2000;
  var MAX_QUEUE = 20;
  var RAGE_WINDOW_MS = 700;
  var RAGE_RADIUS = 40;
  var RAGE_CLICKS = 3;

  var queue = [];
  var timer = null;

  function log() {
    if (DEBUG && window.console) console.log.apply(console, ['[tracker]'].concat([].slice.call(arguments)));
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ---- session storage (localStorage, cookie fallback) ----
  function readStore() {
    try {
      var v = localStorage.getItem(SESSION_KEY);
      if (v) return JSON.parse(v);
    } catch (e) { /* storage blocked */ }
    var m = document.cookie.match(new RegExp('(?:^|; )' + SESSION_KEY + '=([^;]*)'));
    if (m) {
      try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { /* ignore */ }
    }
    return null;
  }

  function writeStore(data) {
    var str = JSON.stringify(data);
    try {
      localStorage.setItem(SESSION_KEY, str);
      return;
    } catch (e) { /* fall through to cookie */ }
    document.cookie = SESSION_KEY + '=' + encodeURIComponent(str) + '; path=/; max-age=' + SESSION_TTL_MS / 1000 + '; SameSite=Lax';
  }

  function getSessionId() {
    var now = Date.now();
    var s = readStore();
    if (!s || !s.id || now - s.last > SESSION_TTL_MS) {
      s = { id: uuid(), last: now };
      log('new session', s.id);
    }
    s.last = now;
    writeStore(s);
    return s.id;
  }

  // ---- page groups ----
  function matches(pattern, pathname) {
    var pat = pattern.replace(/\/+$/, '').split('/');
    var parts = pathname.replace(/\/+$/, '').split('/');
    for (var j = 0; j < pat.length; j++) {
      if (pat[j] === '*') return parts.length > j;
      if (j >= parts.length) return false;
      if (pat[j].charAt(0) === ':') { if (!parts[j]) return false; continue; }
      if (pat[j] !== parts[j]) return false;
    }
    return parts.length === pat.length;
  }

  function groupFor(pathname) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (matches(GROUPS[i], pathname)) return GROUPS[i].replace(/\/+$/, '') || '/';
    }
    return undefined; // server falls back to the path
  }

  // ---- event building ----
  function docSize() {
    var d = document.documentElement, b = document.body || {};
    return {
      w: Math.max(d.scrollWidth, b.scrollWidth || 0, d.clientWidth),
      h: Math.max(d.scrollHeight, b.scrollHeight || 0, d.clientHeight),
    };
  }

  function base(type, url) {
    var size = docSize();
    var href = url || location.href;
    var evt = {
      session_id: getSessionId(),
      event_type: type,
      page_url: href,
      timestamp: new Date().toISOString(),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      page_width: size.w,
      page_height: size.h,
    };
    var g = groupFor(new URL(href).pathname);
    if (g) evt.page_group = g;
    return evt;
  }

  var ACTIONABLE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[onclick]';

  function describe(el) {
    if (!el || !el.tagName) return undefined;
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return s.slice(0, 256);
  }

  function labelFor(target) {
    var named = target.closest && target.closest('[data-track]');
    if (named) return named.getAttribute('data-track').slice(0, 128);
    var el = (target.closest && target.closest(ACTIONABLE)) || target;
    var text = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt'));
    if (!text) text = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 60) : undefined;
  }

  // ---- transport ----
  function send(events, useBeacon) {
    var body = JSON.stringify({ events: events });
    // text/plain is a CORS "simple" content type: no preflight, works with sendBeacon.
    if (useBeacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    }
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true })
      .catch(function (err) { log('send failed', err); });
  }

  function flush(useBeacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    while (queue.length) {
      // Keep batches under the server limit.
      var batch = queue.splice(0, 50);
      log('flush', batch.length, 'events');
      send(batch, useBeacon);
    }
  }

  function enqueue(evt) {
    queue.push(evt);
    log('queued', evt.event_type, evt);
    if (queue.length >= MAX_QUEUE) flush(false);
    else if (!timer) timer = setTimeout(function () { flush(false); }, FLUSH_INTERVAL_MS);
  }

  /** Public: record a custom event. props are whitelisted server-side. */
  function track(type, props, url) {
    var evt = base(type, url);
    if (props && typeof props === 'object') evt.props = props;
    enqueue(evt);
    return evt;
  }

  // ---- current page state (time on page + scroll depth) ----
  var page = null;

  function visibleMs() {
    if (!page) return 0;
    return page.visibleMs + (page.visibleSince ? Date.now() - page.visibleSince : 0);
  }

  function pauseClock() {
    if (!page || !page.visibleSince) return;
    page.visibleMs += Date.now() - page.visibleSince;
    page.visibleSince = 0;
  }

  /** Sends one time_on_page for the current page view (on navigation or unload). */
  function endPage() {
    if (!page || page.ended) return;
    var ms = visibleMs();
    page.ended = true;
    if (ms >= 500) track('time_on_page', { duration_ms: Math.round(ms) }, page.url);
  }

  // Query-string / hash changes (sorting, filters) stay on the same page.
  function pageId(href) {
    var u = new URL(href);
    return u.origin + u.pathname.replace(/\/+$/, '');
  }

  function checkScroll() {
    if (!page || page.id !== pageId(location.href)) return;
    var d = docSize();
    var seen = window.scrollY + window.innerHeight;
    var pct = d.h > 0 ? Math.min(100, (seen / d.h) * 100) : 100;
    [25, 50, 75, 100].forEach(function (m) {
      if (pct >= m - 0.5 && page.depths.indexOf(m) === -1) {
        page.depths.push(m);
        track('scroll_depth', { depth: m });
      }
    });
  }

  function pageView(force) {
    if (page && !force && pageId(location.href) === page.id) {
      page.url = location.href; // same page, new query string
      return;
    }
    endPage();
    page = { id: pageId(location.href), url: location.href, visibleMs: 0, visibleSince: document.visibilityState === 'visible' ? Date.now() : 0, depths: [] };
    var pv = base('page_view');
    if (document.referrer) pv.referrer = document.referrer;
    enqueue(pv);
    // SPA content renders after navigation; measure once it has settled.
    setTimeout(checkScroll, 1200);
  }

  // ---- listeners ----
  var recent = [];
  var rage = null;
  var rageAt = 0;

  document.addEventListener('click', function (e) {
    var t = e.target;
    var actionable = (t.closest && (t.closest('[data-track]') || t.closest(ACTIONABLE))) || t;
    var x = Math.round(e.pageX), y = Math.round(e.pageY);
    // Keyboard / programmatic activation reports 0,0: use the element's centre instead.
    if (e.detail === 0 && actionable.getBoundingClientRect) {
      var r = actionable.getBoundingClientRect();
      if (!r.width && !r.height) return;
      x = Math.round(r.left + r.width / 2 + window.scrollX);
      y = Math.round(r.top + r.height / 2 + window.scrollY);
    }
    var common = { x: x, y: y, target: describe(actionable), target_label: labelFor(t) };

    var evt = base('click');
    for (var k in common) evt[k] = common[k];
    enqueue(evt);

    // Rage clicks: several fast clicks in roughly the same spot.
    var now = Date.now();
    recent = recent.filter(function (c) {
      return now - c.t < RAGE_WINDOW_MS && Math.abs(c.x - x) < RAGE_RADIUS && Math.abs(c.y - y) < RAGE_RADIUS;
    });
    recent.push({ t: now, x: x, y: y });
    if (recent.length >= RAGE_CLICKS) {
      if (rage && now - rageAt < RAGE_WINDOW_MS && queue.indexOf(rage) !== -1) {
        rage.props.count = recent.length; // same burst, still queued: bump the count
      } else if (!rage || now - rageAt >= RAGE_WINDOW_MS) {
        rage = base('rage_click');
        for (var k2 in common) rage[k2] = common[k2];
        rage.props = { count: recent.length };
        enqueue(rage);
      }
      rageAt = now;
    }
  }, true); // capture: still fires when handlers call stopPropagation

  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () { scrollTimer = null; checkScroll(); }, 250);
  }, { passive: true });

  // SPA navigation support.
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () { pageView(); }, 0);
      return r;
    };
  });
  window.addEventListener('popstate', function () { pageView(); });

  // Pause the time-on-page clock while hidden, and deliver what's queued.
  document.addEventListener('visibilitychange', function () {
    if (!page) return;
    if (document.visibilityState === 'hidden') {
      pauseClock();
      flush(true);
    } else if (!page.ended) {
      page.visibleSince = Date.now();
    }
  });
  window.addEventListener('pagehide', function () { endPage(); flush(true); });
  // Restored from the back/forward cache: that's a new page view.
  window.addEventListener('pageshow', function (e) { if (e.persisted) pageView(true); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pageView(); });
  else pageView();

  window.Tracker = { track: function (t, p) { track(t, p); }, flush: function () { flush(false); }, getSessionId: getSessionId };
})();
