import { Link } from 'react-router-dom';
import { categories } from '../catalog.js';
import { usePageTitle } from '../usePageTitle.js';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="not-found card-panel">
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>Sorry, we couldn't find that page</h1>
      <p>The link may be broken, or the page may have been moved. Try searching, or head back to the home page.</p>
      <Link to="/" className="btn btn-yellow btn-lg" data-track="not-found-home">
        Go to ShopVerse home
      </Link>
      <h2 className="not-found-sub">Popular departments</h2>
      <ul className="chip-list">
        {categories.slice(0, 10).map((c) => (
          <li key={c.slug}>
            <Link to={`/category/${c.slug}`} className="chip" data-track="category-tile">
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
