import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, MapPin, Menu, Search, ShoppingCart, X, UserRound } from 'lucide-react';
import { categories, categoryLabel, searchProducts, suggest, formatPrice } from '../catalog.js';
import { track } from '../analytics.js';
import { useCart } from '../CartContext.jsx';
import { lastOrderId } from '../orders.js';

const QUICK_CATEGORIES = ['smartphones', 'laptops', 'beauty', 'home-decoration', 'mens-shirts', 'womens-dresses', 'groceries'];

function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearchPage = location.pathname === '/search';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrapRef = useRef(null);

  // Keep the box in sync with the URL when landing on /search directly.
  useEffect(() => {
    if (onSearchPage) {
      setQuery(params.get('q') || '');
      setCategory(params.get('category') || '');
    }
  }, [onSearchPage, params]);

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const suggestions = open ? suggest(query, category) : [];

  function submit(q) {
    const text = q.trim();
    if (!text && !category) return;
    const results = searchProducts(text, category).length;
    if (text) track('search', { query: text, results }); // category-only browsing isn't a search
    const sp = new URLSearchParams();
    if (text) sp.set('q', text);
    if (category) sp.set('category', category);
    setQuery(text);
    setOpen(false);
    setActive(-1);
    navigate(`/search?${sp}`);
  }

  function onKeyDown(e) {
    if (!suggestions.length) {
      if (e.key === 'ArrowDown' && query.trim()) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      submit(suggestions[active].title);
    }
  }

  return (
    <form
      className="search"
      role="search"
      ref={wrapRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(query);
      }}
    >
      <label className="visually-hidden" htmlFor="search-category">
        Search in category
      </label>
      <select
        id="search-category"
        className="search-category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        data-track="search-category"
      >
        <option value="">All</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="search-field">
        <label className="visually-hidden" htmlFor="search-input">
          Search ShopVerse
        </label>
        <input
          id="search-input"
          type="search"
          placeholder="Search ShopVerse"
          autoComplete="off"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && suggestions[active] ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          data-track="search-input"
        />
        <ul id={listId} role="listbox" aria-label="Search suggestions" className="suggestions" hidden={!suggestions.length}>
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => submit(p.title)}
              data-track="search-suggestion"
            >
              <Search size={14} aria-hidden="true" />
              <span className="suggestion-title">{p.title}</span>
              <span className="suggestion-meta">
                in {categoryLabel(p.category)} · {formatPrice(p.price)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button type="submit" className="search-submit" aria-label="Search" data-track="search-submit">
        <Search size={22} aria-hidden="true" />
      </button>
    </form>
  );
}

function AllMenu({ open, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawer-root">
      <button type="button" className="drawer-overlay" aria-label="Close menu" onClick={onClose} data-track="nav-all-close" />
      <nav className="drawer" aria-label="All categories">
        <div className="drawer-head">
          <UserRound size={22} aria-hidden="true" /> Hello, shopper
          <button type="button" ref={closeRef} className="drawer-close" aria-label="Close menu" onClick={onClose} data-track="nav-all-close">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <h2 className="drawer-title">Trending</h2>
        <ul>
          <li>
            <Link to="/deals" onClick={onClose} data-track="nav-deals">
              Today's Deals
            </Link>
          </li>
          <li>
            <Link to="/search?sort=rating" onClick={onClose} data-track="nav-best-sellers">
              Best Sellers
            </Link>
          </li>
          <li>
            <Link to="/search?sort=new" onClick={onClose} data-track="nav-new-arrivals">
              New Arrivals
            </Link>
          </li>
        </ul>
        <h2 className="drawer-title">Shop by department</h2>
        <ul>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link to={`/category/${c.slug}`} onClick={onClose} data-track="nav-category">
                {c.label}
                <span className="drawer-count">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default function Header() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { pathname } = useLocation();
  const [orderId, setOrderId] = useState(lastOrderId);
  useEffect(() => setOrderId(lastOrderId()), [pathname]);

  return (
    <header className="site-header">
      <div className="header-main">
        <Link to="/" className="logo" aria-label="ShopVerse home" data-track="logo">
          <span className="logo-text">
            Shop<span className="logo-accent">Verse</span>
          </span>
          <span className="logo-smile" aria-hidden="true" />
        </Link>

        <button type="button" className="header-link deliver" data-track="deliver-to" aria-label="Deliver to Bengaluru 560001">
          <MapPin size={18} aria-hidden="true" />
          <span>
            <span className="line-1">Deliver to</span>
            <span className="line-2">Bengaluru 560001</span>
          </span>
        </button>

        <SearchBar />

        <button type="button" className="header-link account" data-track="account">
          <span className="line-1">Hello, guest</span>
          <span className="line-2">
            Account &amp; Lists <ChevronDown size={14} aria-hidden="true" />
          </span>
        </button>

        <Link to={orderId ? `/order/${orderId}` : '/cart'} className="header-link orders" data-track="nav-orders">
          <span className="line-1">Returns</span>
          <span className="line-2">&amp; Orders</span>
        </Link>

        <Link to="/cart" className="header-link cart-link" data-track="nav-cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
          <span className="cart-icon">
            <ShoppingCart size={34} strokeWidth={1.75} aria-hidden="true" />
            <span className="cart-count" aria-hidden="true">
              {count > 99 ? '99+' : count}
            </span>
          </span>
          <span className="line-2 cart-label">Cart</span>
        </Link>
      </div>

      <nav className="header-nav" aria-label="Quick links">
        <button type="button" className="nav-all" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen} data-track="nav-all">
          <Menu size={20} aria-hidden="true" /> All
        </button>
        <ul className="nav-links">
          <li>
            <NavLink to="/deals" data-track="nav-deals">
              Today's Deals
            </NavLink>
          </li>
          <li>
            <Link to="/search?sort=rating" data-track="nav-best-sellers">
              Best Sellers
            </Link>
          </li>
          <li>
            <Link to="/search?sort=new" data-track="nav-new-arrivals">
              New Arrivals
            </Link>
          </li>
          {QUICK_CATEGORIES.map((slug) => (
            <li key={slug}>
              <NavLink to={`/category/${slug}`} data-track="nav-category">
                {categoryLabel(slug)}
              </NavLink>
            </li>
          ))}
        </ul>
        <span className="nav-promo">Free ShopVerse Fast delivery on orders over $35</span>
      </nav>

      <AllMenu open={menuOpen} onClose={closeMenu} />
    </header>
  );
}
