// Empty => same origin (Vite dev proxy, or dashboard served by the API in prod).
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function get(path, params) {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  const res = await fetch(`${BASE}${path}${qs}`);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      msg = (await res.json()).error || msg;
    } catch { /* non-JSON error */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  sessions: (limit, skip) => get('/api/sessions', { limit, skip }),
  sessionEvents: (id) => get(`/api/sessions/${encodeURIComponent(id)}/events`),
  pages: () => get('/api/pages'),
  heatmap: (pageUrl) => get('/api/heatmap', { page_url: pageUrl }),
};
