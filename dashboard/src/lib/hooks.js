import { useMemo } from 'react';
import { fmtDay, fmtHour } from './format.js';
import { useFilters } from './filters.jsx';
import { useApi } from './useApi.js';

/** { range, device } ready to pass to the API. */
export function useQueryFilters() {
  const { range, device } = useFilters();
  return useMemo(() => ({ range, device: device || undefined }), [range, device]);
}

/** Axis tick for a timeseries bucket. */
export const bucketTick = (interval) => (t) => (interval === 'hour' ? fmtHour(t) : fmtDay(t));
export const bucketLabel = (interval) => (t) =>
  interval === 'hour' ? `${fmtDay(t)}, ${fmtHour(t)}` : new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * page_group → { page_url (page key), sample_url } so views that only know the
 * group (clicks, flows, live) can link to the heatmap.
 */
export function usePageIndex(range) {
  const q = useApi('/api/pages', { range: range || 'all' });
  return useMemo(() => {
    const m = new Map();
    for (const p of q.data?.pages || []) if (!m.has(p.page_group)) m.set(p.page_group, p);
    return m;
  }, [q.data]);
}
