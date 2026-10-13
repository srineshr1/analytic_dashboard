import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

/**
 * Generic table.
 * columns: [{ key, label, align?, render?(row), sortValue?(row), sortable?, className? }]
 * When `onRowClick` is set rows become keyboard-activatable (Enter / Space).
 */
export function DataTable({
  columns,
  rows,
  caption,
  rowKey = (r, i) => i,
  onRowClick,
  rowLabel,
  defaultSort,
  sortable = false,
  dense = false,
  rowClassName,
}) {
  const [sort, setSort] = useState(defaultSort || null); // { key, dir }

  const sorted = useMemo(() => {
    if (!sortable || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue || ((r) => r[col.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (typeof va === 'string' || typeof vb === 'string') return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
      return ((va ?? 0) - (vb ?? 0)) * dir;
    });
  }, [rows, sort, columns, sortable]);

  const toggle = (key) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

  return (
    <div className="table-wrap">
      <table className={`table ${dense ? 'table-dense' : ''} ${onRowClick ? 'table-clickable' : ''}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const canSort = sortable && c.sortable !== false;
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              return (
                <th key={c.key} scope="col" className={`${c.align === 'right' ? 'num' : ''} ${c.className || ''}`} aria-sort={canSort ? ariaSort || 'none' : undefined}>
                  {canSort ? (
                    <button type="button" className={`th-sort ${active ? 'is-active' : ''}`} onClick={() => toggle(c.key)}>
                      {c.label}
                      {active ? (
                        sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />
                      ) : (
                        <ArrowUpDown size={12} aria-hidden="true" className="th-sort-idle" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={rowKey(r, i)}
              className={rowClassName?.(r) || ''}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(r);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
            >
              {columns.map((c, ci) => {
                const content = c.render ? c.render(r, i) : r[c.key];
                const cls = `${c.align === 'right' ? 'num' : ''} ${c.className || ''}`;
                return ci === 0 ? (
                  <th key={c.key} scope="row" className={`${cls} cell-primary`}>{content}</th>
                ) : (
                  <td key={c.key} className={cls}>{content}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
