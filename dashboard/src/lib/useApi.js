import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, buildQuery } from '../api.js';
import { useRefresh } from './filters.jsx';

/**
 * Fetches `path` with `params`. Refetches when the query changes, when the
 * global refresh button is pressed, on `reload()`, and every `interval` ms.
 * Previous data is kept while refetching so charts don't flash.
 *
 * @returns {{ data: any, error: Error|null, loading: boolean, reload: () => void, updatedAt: number|null }}
 */
export function useApi(path, params = {}, { enabled = true, interval = 0 } = {}) {
  const { tick } = useRefresh();
  const key = path ? `${path}${buildQuery(params)}` : null;
  const [state, setState] = useState({ key: null, data: null, error: null, loading: Boolean(enabled && key), updatedAt: null });
  const [nonce, setNonce] = useState(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !key) {
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    const ctrl = new AbortController();
    setState((s) => ({
      ...s,
      loading: true,
      // Drop stale data from a *different* query (e.g. another page in the heatmap).
      ...(s.key !== key ? { data: null, error: null } : null),
      key,
    }));
    apiGet(path, paramsRef.current, { signal: ctrl.signal })
      .then((data) => setState({ key, data, error: null, loading: false, updatedAt: Date.now() }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState((s) => ({ ...s, error, loading: false }));
      });
    return () => ctrl.abort();
  }, [key, enabled, tick, nonce, path]);

  useEffect(() => {
    if (!interval || !enabled || !key) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, interval);
    return () => clearInterval(id);
  }, [interval, enabled, key, reload]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: enabled && key ? state.loading || !current : false,
    reload,
    updatedAt: state.updatedAt,
  };
}
