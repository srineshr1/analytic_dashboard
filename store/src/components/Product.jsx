import { Link } from 'react-router-dom';
import { Check, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatPrice, originalPrice, ratingCount, isFast, deliveryDate } from '../catalog.js';
import { useCart } from '../CartContext.jsx';
import { toast } from './Toast.jsx';

export function Stars({ rating, count, size = 'md' }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className={`stars stars-${size}`}>
      <span className="stars-icons" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        <span className="stars-bg" aria-hidden="true">★★★★★</span>
        <span className="stars-fg" aria-hidden="true" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      {count !== undefined && <span className="stars-count">{count.toLocaleString('en-US')}</span>}
    </span>
  );
}

/** Amazon-style price: small "$", big dollars, superscript cents. */
export function Price({ value, size = 'md' }) {
  const [whole, cents] = value.toFixed(2).split('.');
  return (
    <span className={`price price-${size}`} aria-label={formatPrice(value)}>
      <span className="price-symbol" aria-hidden="true">$</span>
      <span className="price-whole" aria-hidden="true">{Number(whole).toLocaleString('en-US')}</span>
      <span className="price-fraction" aria-hidden="true">{cents}</span>
    </span>
  );
}

export function FastBadge() {
  return (
    <span className="fast-badge">
      <Check size={12} strokeWidth={3} aria-hidden="true" />
      ShopVerse <em>Fast</em>
    </span>
  );
}

export function WishlistButton({ product }) {
  const [on, setOn] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem('sv_wishlist')) || []).includes(String(product.id));
    } catch {
      return false;
    }
  });
  function toggle() {
    const id = String(product.id);
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem('sv_wishlist')) || [];
    } catch {
      /* ignore */
    }
    const next = on ? list.filter((x) => x !== id) : [...new Set([...list, id])];
    try {
      localStorage.setItem('sv_wishlist', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setOn(!on);
    toast(on ? 'Removed from your wish list' : 'Added to your wish list');
  }
  return (
    <button
      type="button"
      className={`wishlist-btn${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${product.title} from wish list` : `Add ${product.title} to wish list`}
      onClick={toggle}
      data-track="wishlist"
    >
      <Heart size={18} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

export function ProductCard({ product, trackName = 'product-card', variant = 'grid' }) {
  const { add } = useCart();
  const was = originalPrice(product);
  const off = Math.round(product.discountPercentage);
  const to = `/product/${product.id}`;
  return (
    <article className={`product-card product-card-${variant}`}>
      <div className="product-card-media">
        <Link to={to} data-track={trackName} tabIndex={-1} aria-hidden="true">
          <img src={product.thumbnail} alt="" loading="lazy" decoding="async" width="300" height="300" />
        </Link>
        {off >= 15 && <span className="deal-flag">{off}% off</span>}
        <WishlistButton product={product} />
      </div>
      <div className="product-card-body">
        <Link to={to} className="product-card-title" data-track={trackName}>
          {product.title}
        </Link>
        {variant === 'grid' && <span className="product-card-brand">{product.brand}</span>}
        <Stars rating={product.rating} count={ratingCount(product)} size="sm" />
        <div className="product-card-price">
          <Price value={product.price} />
          {was && (
            <span className="was">
              List: <s>{formatPrice(was)}</s>
            </span>
          )}
        </div>
        {isFast(product) && <FastBadge />}
        {variant === 'grid' && (
          <p className="product-card-delivery">
            FREE delivery <strong>{deliveryDate(product.price >= 35 ? 2 : 4)}</strong>
          </p>
        )}
        {product.stock > 0 ? (
          <button
            type="button"
            className="btn btn-yellow btn-sm product-card-add"
            onClick={() => {
              add(product, 1);
              toast(`Added "${product.title}" to cart`);
            }}
            data-track="add-to-cart"
          >
            Add to Cart
          </button>
        ) : (
          <p className="out-of-stock">Currently unavailable</p>
        )}
      </div>
    </article>
  );
}

/** Horizontally scrolling product row with arrow buttons. */
export function ProductRow({ title, products, link, linkLabel = 'See more', trackName = 'product-card', id }) {
  const scroller = useRef(null);
  const scroll = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  if (!products.length) return null;
  const headingId = id || `row-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className="card-panel product-row" aria-labelledby={headingId}>
      <div className="row-head">
        <h2 id={headingId}>{title}</h2>
        {link && (
          <Link to={link} className="link" data-track="row-see-more">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="row-wrap">
        <button type="button" className="row-arrow left" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} data-track="row-prev">
          <ChevronLeft size={28} aria-hidden="true" />
        </button>
        <ul className="row-scroller" ref={scroller}>
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} trackName={trackName} variant="row" />
            </li>
          ))}
        </ul>
        <button type="button" className="row-arrow right" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} data-track="row-next">
          <ChevronRight size={28} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
