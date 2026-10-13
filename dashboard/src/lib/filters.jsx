import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export const RANGES = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];
export const DEFAULT_RANGE = '7d';
export const DEVICES = ['desktop', 'tablet', 'mobile'];
const RANGE_VALUES = new Set(['1h', ...RANGES.map((r) => r.value)]);

/**
 * Global filters live in the URL (?range=&device=) so views are shareable.
 * Navigation links carry them along via `useFilterHref`.
 */
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const rawRange = params.get('range');
  const range = RANGE_VALUES.has(rawRange) ? rawRange : DEFAULT_RANGE;
  const rawDevice = params.get('device');
  const device = DEVICES.includes(rawDevice) ? rawDevice : '';

  const update = useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: false },
      ),
    [setParams],
  );

  const setRange = useCallback((r) => update({ range: r }), [update]);
  const setDevice = useCallback((d) => update({ device: d || null }), [update]);

  return { range, device, setRange, setDevice, params, update };
}

/** Returns a function building `path?range=..&device=..&extra..` from the current filters. */
export function useFilterHref() {
  const location = useLocation();
  return useCallback(
    (path, extra = {}) => {
      const cur = new URLSearchParams(location.search);
      const next = new URLSearchParams();
      for (const k of ['range', 'device']) if (cur.get(k)) next.set(k, cur.get(k));
      for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== '') next.set(k, v);
      const s = next.toString();
      return s ? `${path}?${s}` : path;
    },
    [location.search],
  );
}

/* Manual "refresh everything" signal shared by every useApi call. */
const RefreshContext = createContext({ tick: 0, refresh: () => {} });

export function RefreshProvider({ children }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const value = useMemo(() => ({ tick, refresh }), [tick, refresh]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export const useRefresh = () => useContext(RefreshContext);
