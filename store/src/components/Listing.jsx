import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard, Stars } from './Product.jsx';
import { brandOf, categories, categoryLabel, PRICE_RANGES, SORTS, sortProducts } from '../catalog.js';

export const PAGE_SIZE = 24;
const BRAND_LIMIT = 10;

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} data-track="pagination">
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={n === page ? 'current' : undefined}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Page ${n}`}
            onClick={() => onPage(n)}
            data-track="pagination"
          >
            {n}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} data-track="pagination">
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

/**
 * Shared results page: filter sidebar + sort + grid + pagination.
 * All filter state lives in the query string so results are linkable and the back button works.
 */
export default function Listing({ title, subtitle, base, query, categoryMode = 'filter', currentCategory, cardTrack = 'product-card', emptyHint }) {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  const category = categoryMode === 'filter' ? params.get('category') || '' : '';
  const brands = useMemo(() => (params.get('brand') || '').split('|').filter(Boolean), [params]);
  const price = params.get('price') || '';
  const minRating = Number(params.get('rating')) || 0;
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'featured';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join('|') : String(v));
    }
    if (!keepPage) next.delete('page');
    setParams(next);
  };

  const inCategory = useMemo(() => (category ? base.filter((p) => p.category === category) : base), [base, category]);

  const categoryCounts = useMemo(() => {
    const m = new Map();
    for (const p of base) m.set(p.category, (m.get(p.category) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [base]);

  const brandCounts = useMemo(() => {
    const m = new Map();
    for (const p of inCategory) m.set(brandOf(p), (m.get(brandOf(p)) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [inCategory]);

  const filtered = useMemo(() => {
    const range = PRICE_RANGES.find((r) => r.value === price);
    const list = inCategory.filter(
      (p) =>
        (!brands.length || brands.includes(brandOf(p))) &&
        (!range || (p.price >= range.min && p.price < range.max)) &&
        p.rating >= minRating,
    );
    return sortProducts(list, sort);
  }, [inCategory, brands, price, minRating, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const activeFilters = brands.length + (price ? 1 : 0) + (minRating ? 1 : 0) + (category ? 1 : 0);
  const visibleBrands = showAllBrands ? brandCounts : brandCounts.slice(0, BRAND_LIMIT);
  // Always show selected brands even when the list is collapsed.
  const hiddenSelected = brandCounts.filter(([b]) => brands.includes(b) && !visibleBrands.some(([v]) => v === b));

  const toggleBrand = (b) => update({ brand: brands.includes(b) ? brands.filter((x) => x !== b) : [...brands, b] });

  const from = filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(current * PAGE_SIZE, filtered.length);

  return (
    <div className="listing">
      <div className="results-bar">
        <p className="results-count" aria-live="polite">
          {filtered.length ? `${from}-${to} of ${filtered.length} result${filtered.length === 1 ? "" : "s"}` : "No results"}
          {query ? (
            <>
              {' '}
              for <strong className="query">"{query}"</strong>
            </>
          ) : null}
          {category && (
            <>
              {' '}
              in <strong>{categoryLabel(category)}</strong>
            </>
          )}
        </p>
        <div className="results-tools">
          <button
            type="button"
            className="btn btn-outline btn-sm filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="filters"
            onClick={() => setFiltersOpen((o) => !o)}
            data-track="filter-toggle"
          >
            <SlidersHorizontal size={16} aria-hidden="true" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
          <label className="sort-label">
            <span>Sort by:</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value === 'featured' ? '' : e.target.value })} data-track="sort-select">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="listing-body">
        <aside id="filters" className={`filters${filtersOpen ? ' open' : ''}`} aria-label="Filters">
          <div className="filters-mobile-head">
            <strong>Filters</strong>
            <button type="button" className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Close filters" data-track="filter-close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {activeFilters > 0 && (
            <button
              type="button"
              className="link clear-filters"
              onClick={() => update({ brand: '', price: '', rating: '', category: categoryMode === 'filter' ? '' : undefined })}
              data-track="filter-clear"
            >
              Clear all filters
            </button>
          )}

          <fieldset className="filter-group">
            <legend>Department</legend>
            {categoryMode === 'filter' ? (
              <ul className="filter-cats">
                {category && (
                  <li>
                    <button type="button" className="link" onClick={() => update({ category: '', brand: '' })} data-track="filter-category">
                      ‹ Any department
                    </button>
                  </li>
                )}
                {categoryCounts.map(([slug, n]) => (
                  <li key={slug}>
                    <button
                      type="button"
                      className={`link${slug === category ? ' selected' : ''}`}
                      aria-pressed={slug === category}
                      onClick={() => update({ category: slug === category ? '' : slug, brand: '' })}
                      data-track="filter-category"
                    >
                      {categoryLabel(slug)} <span className="muted">({n})</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="filter-cats">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      to={`/category/${c.slug}`}
                      className={`link${c.slug === currentCategory ? ' selected' : ''}`}
                      aria-current={c.slug === currentCategory ? 'page' : undefined}
                      data-track="filter-category"
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {brandCounts.length > 0 && (
            <fieldset className="filter-group">
              <legend>Brands</legend>
              <ul>
                {[...visibleBrands, ...hiddenSelected].map(([b, n]) => (
                  <li key={b}>
                    <label className="check">
                      <input type="checkbox" checked={brands.includes(b)} onChange={() => toggleBrand(b)} data-track="filter-brand" />
                      <span>
                        {b} <span className="muted">({n})</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {brandCounts.length > BRAND_LIMIT && (
                <button type="button" className="link small" onClick={() => setShowAllBrands((s) => !s)} aria-expanded={showAllBrands} data-track="filter-brand-more">
                  {showAllBrands ? 'See less' : `See all ${brandCounts.length} brands`}
                </button>
              )}
            </fieldset>
          )}

          <fieldset className="filter-group">
            <legend>Price</legend>
            <ul>
              <li>
                <label className="radio">
                  <input type="radio" name="price" checked={!price} onChange={() => update({ price: '' })} data-track="filter-price" />
                  <span>Any price</span>
                </label>
              </li>
              {PRICE_RANGES.map((r) => (
                <li key={r.value}>
                  <label className="radio">
                    <input type="radio" name="price" checked={price === r.value} onChange={() => update({ price: r.value })} data-track="filter-price" />
                    <span>{r.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Customer Reviews</legend>
            <ul>
              {[4, 3, 2, 1].map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    className={`rating-filter${minRating === r ? ' selected' : ''}`}
                    aria-pressed={minRating === r}
                    onClick={() => update({ rating: minRating === r ? '' : r })}
                    data-track="filter-rating"
                  >
                    <Stars rating={r} size="sm" /> <span>&amp; Up</span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          <button type="button" className="btn btn-yellow btn-block filters-apply" onClick={() => setFiltersOpen(false)} data-track="filter-apply">
            Show {filtered.length} results
          </button>
        </aside>

        <section className="results" aria-labelledby="results-title">
          <header className="results-head">
            <h1 id="results-title">{title}</h1>
            {subtitle && <p className="muted">{subtitle}</p>}
          </header>
          {pageItems.length ? (
            <ul className="product-grid">
              {pageItems.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} trackName={cardTrack} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card-panel empty-results">
              <h2>No results{query ? ` for "${query}"` : ''}.</h2>
              <p>{emptyHint || 'Try checking your spelling, using more general terms, or removing some filters.'}</p>
              {activeFilters > 0 && (
                <button type="button" className="btn btn-yellow" onClick={() => update({ brand: '', price: '', rating: '', category: '' })} data-track="filter-clear">
                  Clear filters
                </button>
              )}
              <Link to="/" className="btn btn-outline" data-track="continue-shopping">
                Continue shopping
              </Link>
            </div>
          )}
          <Pagination
            page={current}
            pages={pages}
            onPage={(n) => {
              update({ page: n === 1 ? '' : n }, true);
            }}
          />
        </section>
      </div>
    </div>
  );
}
