/**
 * Thin, never-throwing wrapper around window.Tracker (loaded from /tracker.js with `defer`).
 *
 * The tracker script is declared before the app's module script, so it is normally ready
 * by the time React renders. If it isn't (slow network, blocked script), events are queued
 * and retried on window `load` and on a short interval, then dropped after ~15 s.
 */
const MAX_QUEUE = 100;
const RETRY_MS = 250;
const MAX_RETRIES = 60;

const queue = [];
let timer = null;
let retries = 0;

function tracker() {
  try {
    const t = typeof window !== 'undefined' ? window.Tracker : undefined;
    return t && typeof t.track === 'function' ? t : null;
  } catch {
    return null;
  }
}

function flushQueue() {
  const t = tracker();
  if (!t) return false;
  while (queue.length) {
    const [type, props] = queue.shift();
    try {
      t.track(type, props);
    } catch {
      /* ignore tracker errors */
    }
  }
  return true;
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function scheduleRetry() {
  if (timer || typeof window === 'undefined') return;
  retries = 0;
  timer = setInterval(() => {
    retries += 1;
    if (flushQueue()) stopTimer();
    else if (retries >= MAX_RETRIES) {
      stopTimer();
      queue.length = 0; // tracker never arrived (blocked?) — give up quietly
    }
  }, RETRY_MS);
  window.addEventListener('load', () => flushQueue() && stopTimer(), { once: true });
}

export function track(type, props = {}) {
  try {
    const t = tracker();
    if (t && queue.length === 0) {
      t.track(type, props);
      return;
    }
    if (queue.length < MAX_QUEUE) queue.push([type, props]);
    if (!flushQueue()) scheduleRetry();
  } catch {
    /* analytics must never break the store */
  }
}

/** Shape a product for analytics payloads. product_id is always a string. */
export function productProps(p, quantity) {
  const props = {
    product_id: String(p.id),
    product_name: p.title,
    category: p.category,
    price: p.price,
  };
  if (quantity !== undefined) props.quantity = quantity;
  return props;
}
