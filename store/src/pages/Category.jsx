import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import Listing from '../components/Listing.jsx';
import NotFound from './NotFound.jsx';
import { categoryLabel, categorySlugs, products } from '../catalog.js';
import { usePageTitle } from '../usePageTitle.js';

export default function Category() {
  const { slug } = useParams();
  const valid = categorySlugs.has(slug);
  const base = useMemo(() => products.filter((p) => p.category === slug), [slug]);
  const label = categoryLabel(slug);
  usePageTitle(valid ? label : 'Page not found');

  if (!valid) return <NotFound />;

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/" data-track="breadcrumb">
              Home
            </Link>
          </li>
          <li aria-current="page">{label}</li>
        </ol>
      </nav>
      <div className={`category-banner cat-${slug}`}>
        <div>
          <p className="hero-eyebrow">Shop by department</p>
          <h2>{label}</h2>
          <p>
            {base.length} products · Free ShopVerse Fast delivery on eligible items
          </p>
        </div>
        <div className="category-banner-imgs" aria-hidden="true">
          {base.slice(0, 3).map((p) => (
            <img key={p.id} src={p.thumbnail} alt="" />
          ))}
        </div>
      </div>
      <Listing key={slug} title={label} base={base} categoryMode="route" currentCategory={slug} />
    </>
  );
}
