// Thin fetch wrapper for the analytics API.
// VITE_API_URL can point the dashboard at an API on another origin; by default
// requests are same-origin (served by the backend, or proxied by Vite in dev).
const PREFIX = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Builds "?a=1&b=2", skipping null/undefined/empty values. */
export function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    qs.set(k, v === true ? '1' : String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function apiUrl(path, params) {
  return `${PREFIX}${path}${buildQuery(params)}`;
}

export async function apiGet(path, params, { signal } = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path, params), { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the analytics API. Is the backend running?', 0);
  }

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (res.ok) throw new ApiError('The API returned an invalid response.', res.status);
    }
  }

  if (!res.ok) {
    const msg = body?.error || `${res.status} ${res.statusText || 'Request failed'}`;
    throw new ApiError(res.status === 404 ? `Not found: ${msg}` : msg, res.status);
  }
  return body;
}
