/*!
 * Lightweight analytics tracker.
 *
 * Usage:
 *   <script src="https://your-api.example.com/tracker.js" defer></script>
 *   (optional) data-endpoint="https://your-api.example.com/api/events"
 *
 * Tracks page_view and click events, batches them, and sends them to the API.
 * Exposes window.Tracker = { flush, getSessionId, track }.
 */
(function () {
  'use strict';
  if (window.Tracker) return; // already loaded
  // Dashboard heatmap previews load the page with ?ua_preview=1; don't record those.
  if (/[?&]ua_preview=1(&|$)/.test(location.search)) return;

  var script = document.currentScript;
  var ENDPOINT =
    (script && script.getAttribute('data-endpoint')) ||
    (script && script.src ? new URL('/api/events', script.src).href : '/api/events');
  var DEBUG = !!(script && script.hasAttribute('data-debug'));

  var SESSION_KEY = 'ua_session';
  var SESSION_TTL_MS = 30 * 60 * 1000; // new session after 30 min of inactivity
  var FLUSH_INTERVAL_MS = 2000;
  var MAX_QUEUE = 20;

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

  // ---- storage (localStorage, cookie fallback) ----
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
    document.cookie =
      SESSION_KEY + '=' + encodeURIComponent(str) + '; path=/; max-age=' + SESSION_TTL_MS / 1000 + '; SameSite=Lax';
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

  // ---- event building ----
  function docSize() {
    var d = document.documentElement, b = document.body || {};
    return {
      w: Math.max(d.scrollWidth, b.scrollWidth || 0, d.clientWidth),
      h: Math.max(d.scrollHeight, b.scrollHeight || 0, d.clientHeight),
    };
  }

  function base(type) {
    var size = docSize();
    return {
      session_id: getSessionId(),
      event_type: type,
      page_url: location.href,
      timestamp: new Date().toISOString(),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      page_width: size.w,
      page_height: size.h,
    };
  }

  function describe(el) {
    if (!el || !el.tagName) return undefined;
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return s.slice(0, 256);
  }

  // ---- transport ----
  function send(events, useBeacon) {
    var body = JSON.stringify({ events: events });
    // text/plain is a CORS "simple" content type: no preflight, works with sendBeacon.
    if (useBeacon && navigator.sendBeacon) {
      var ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
      if (ok) return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: body,
      keepalive: true,
    }).catch(function (err) {
      log('send failed', err);
    });
  }

  function flush(useBeacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!queue.length) return;
    var batch = queue.splice(0, queue.length);
    log('flush', batch.length, 'events');
    send(batch, useBeacon);
  }

  function enqueue(evt) {
    queue.push(evt);
    log('queued', evt.event_type, evt);
    if (queue.length >= MAX_QUEUE) flush(false);
    else if (!timer) timer = setTimeout(function () { flush(false); }, FLUSH_INTERVAL_MS);
  }

  function track(type, extra) {
    var evt = base(type);
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) evt[k] = extra[k];
    enqueue(evt);
  }

  // ---- listeners ----
  var lastUrl = null;
  function pageView() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    track('page_view', { referrer: document.referrer || undefined });
  }

  document.addEventListener(
    'click',
    function (e) {
      track('click', {
        x: Math.round(e.pageX),
        y: Math.round(e.pageY),
        target: describe(e.target),
      });
    },
    true // capture: still fires when handlers call stopPropagation
  );

  // SPA navigation support.
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(pageView, 0);
      return r;
    };
  });
  window.addEventListener('popstate', pageView);

  // Deliver whatever is left when the page goes away.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', function () { flush(true); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pageView);
  else pageView();

  window.Tracker = { flush: function () { flush(false); }, getSessionId: getSessionId, track: track };
})();
