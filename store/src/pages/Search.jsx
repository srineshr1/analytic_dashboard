import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Listing from '../components/Listing.jsx';
import { searchProducts } from '../catalog.js';
import { usePageTitle } from '../usePageTitle.js';

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const sort = params.get('sort');
  const base = useMemo(() => searchProducts(q), [q]);

  const title = q ? 'Results' : sort === 'rating' ? 'Best Sellers' : sort === 'new' ? 'New Arrivals' : 'All products';
  usePageTitle(q ? `ShopVerse : ${q}` : title);

  return (
    <Listing
      key={q}
      title={title}
      subtitle={q ? 'Check each product page for other buying options.' : 'Browse our full catalog.'}
      base={base}
      query={q}
      categoryMode="filter"
    />
  );
}
