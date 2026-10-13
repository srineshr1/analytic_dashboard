import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { categories } from '../catalog.js';

const COLUMNS = [
  {
    title: 'Get to Know Us',
    links: [
      ['About ShopVerse', '/'],
      ['Careers', '/'],
      ['Press Releases', '/'],
      ['ShopVerse Science', '/'],
    ],
  },
  {
    title: 'Shop with Us',
    links: [
      ["Today's Deals", '/deals'],
      ['Best Sellers', '/search?sort=rating'],
      ['New Arrivals', '/search?sort=new'],
      ...categories.slice(0, 3).map((c) => [c.label, `/category/${c.slug}`]),
    ],
  },
  {
    title: 'Popular Departments',
    links: ['smartphones', 'laptops', 'furniture', 'womens-bags', 'mens-watches', 'skin-care'].map((slug) => {
      const c = categories.find((x) => x.slug === slug);
      return [c ? c.label : slug, `/category/${slug}`];
    }),
  },
  {
    title: 'Let Us Help You',
    links: [
      ['Your Cart', '/cart'],
      ['Shipping Rates & Policies', '/'],
      ['Returns & Replacements', '/'],
      ['Help', '/'],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <button type="button" className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} data-track="back-to-top">
        Back to top
      </button>
      <div className="footer-columns">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2>{col.title}</h2>
            <ul>
              {col.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} data-track="footer-link">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="footer-bottom">
        <Link to="/" className="logo logo-sm" data-track="footer-logo" aria-label="ShopVerse home">
          <span className="logo-text">
            Shop<span className="logo-accent">Verse</span>
          </span>
        </Link>
        <span className="footer-locale">
          <Globe size={14} aria-hidden="true" /> English · USD $ · United States
        </span>
      </div>
      <div className="footer-legal">
        <p>
          Demo store for the User Analytics project. Product data and images from DummyJSON. No real orders are placed.
        </p>
        <p>© {new Date().getFullYear()} ShopVerse</p>
      </div>
    </footer>
  );
}
