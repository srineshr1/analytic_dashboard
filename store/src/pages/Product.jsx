import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, MapPin, RotateCcw, ShieldCheck, ThumbsUp, Truck, UserRound } from 'lucide-react';
import NotFound from './NotFound.jsx';
import QtyControl from '../components/QtyControl.jsx';
import { FastBadge, Price, ProductRow, Stars, WishlistButton } from '../components/Product.jsx';
import { categoryLabel, deliveryDate, formatPrice, isFast, originalPrice, productById, products, ratingCount } from '../catalog.js';
import { track } from '../analytics.js';
import { useCart } from '../CartContext.jsx';
import { rememberViewed } from '../recent.js';
import { toast } from '../components/Toast.jsx';
import { usePageTitle } from '../usePageTitle.js';

/** Plausible star distribution centred on the average rating (sums to 100). */
function distribution(rating) {
  const w = [5, 4, 3, 2, 1].map((k) => Math.exp(-((k - rating) ** 2) / 1.4));
  const total = w.reduce((a, b) => a + b, 0);
  const pct = w.map((x) => Math.round((x / total) * 100));
  pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
  return pct;
}

function Gallery({ product }) {
  const images = product.images?.length ? product.images : [product.thumbnail];
  const [active, setActive] = useState(0);
  return (
    <div className="gallery">
      {images.length > 1 && (
        <ul className="gallery-thumbs" aria-label="Product images">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                className={i === active ? 'active' : undefined}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                data-track="gallery-thumb"
              >
                <img src={src} alt="" loading="lazy" width="60" height="60" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="gallery-main">
        <img src={images[active]} alt={`${product.title}, image ${active + 1} of ${images.length}`} width="600" height="600" />
      </div>
    </div>
  );
}


function Reviews({ product }) {
  const count = ratingCount(product);
  const dist = distribution(product.rating);
  const [helpful, setHelpful] = useState({});
  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <div className="reviews-summary">
        <h2 id="reviews-title">Customer reviews</h2>
        <div className="reviews-avg">
          <Stars rating={product.rating} size="lg" />
          <span>{product.rating.toFixed(1)} out of 5</span>
        </div>
        <p className="muted">{count.toLocaleString('en-US')} global ratings</p>
        <ul className="dist">
          {dist.map((pct, i) => (
            <li key={i}>
              <span className="dist-label">{5 - i} star</span>
              <span
                className="dist-bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${5 - i} star reviews`}
              >
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="dist-pct">{pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="reviews-list">
        <h3>Top reviews from the United States</h3>
        {product.reviews.length === 0 && <p className="muted">No written reviews yet.</p>}
        <ul>
          {product.reviews.map((r, i) => (
            <li key={i} className="review">
              <p className="review-author">
                <span className="avatar" aria-hidden="true">
                  <UserRound size={18} />
                </span>
                {r.reviewerName}
              </p>
              <p className="review-head">
                <Stars rating={r.rating} size="sm" />
                <strong>{r.rating >= 4 ? 'Highly recommend' : r.rating >= 3 ? 'Does the job' : 'Not what I expected'}</strong>
              </p>
              <p className="muted small">
                Reviewed on {new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} ·{' '}
                <span className="verified">Verified Purchase</span>
              </p>
              <p className="review-body">{r.comment}</p>
              {helpful[i] ? (
                <p className="helpful-thanks small" role="status">
                  Thank you for your feedback.
                </p>
              ) : (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setHelpful((h) => ({ ...h, [i]: true }))} data-track="review-helpful">
                  <ThumbsUp size={14} aria-hidden="true" /> Helpful
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BuyBox({ product }) {
  const { add, MAX_QTY } = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const max = Math.max(1, Math.min(MAX_QTY, product.stock));
  const inStock = product.stock > 0;
  const fast = isFast(product);

  return (
    <aside className="buy-box" aria-label="Purchase options">
      <Price value={product.price} size="lg" />
      <p className="buy-delivery">
        <Truck size={16} aria-hidden="true" /> FREE delivery <strong>{deliveryDate(fast ? 2 : 5)}</strong>
        {fast && (
          <>
            . Or fastest delivery <strong>Tomorrow</strong>. Order within <span className="countdown">4 hrs 12 mins</span>
          </>
        )}
      </p>
      <p className="buy-location">
        <MapPin size={14} aria-hidden="true" /> Deliver to Bengaluru 560001
      </p>
      <p className={`stock ${inStock ? (product.stock < 10 ? 'low' : 'in') : 'out'}`}>
        {inStock ? (product.stock < 10 ? `Only ${product.stock} left in stock - order soon.` : 'In Stock') : 'Currently unavailable.'}
      </p>
      {inStock && (
        <>
          <div className="buy-qty">
            <span id="buy-qty-label">Quantity:</span>
            <QtyControl value={qty} max={max} onChange={(v) => setQty(Math.max(1, Math.min(max, v)))} />
          </div>
          <button
            type="button"
            className="btn btn-yellow btn-block btn-pill"
            onClick={() => {
              add(product, qty);
              toast(`Added ${qty} × "${product.title}" to cart`);
            }}
            data-track="add-to-cart"
          >
            Add to Cart
          </button>
          <button
            type="button"
            className="btn btn-orange btn-block btn-pill"
            onClick={() => {
              add(product, qty);
              navigate('/checkout');
            }}
            data-track="buy-now"
          >
            Buy Now
          </button>
        </>
      )}
      <p className="buy-secure">
        <Lock size={14} aria-hidden="true" /> Secure transaction
      </p>
      <dl className="buy-facts">
        <dt>Ships from</dt>
        <dd>ShopVerse</dd>
        <dt>Sold by</dt>
        <dd>{product.brand}</dd>
        <dt>Returns</dt>
        <dd>{product.returnPolicy}</dd>
      </dl>
      <div className="buy-wishlist">
        <WishlistButton product={product} /> <span>Add to List</span>
      </div>
    </aside>
  );
}

export default function Product() {
  const { id } = useParams();
  const product = productById.get(String(id));
  usePageTitle(product ? product.title : 'Page not found');

  // product_view: once per product id (guards StrictMode's double effect run in dev).
  const lastViewed = useRef(null);
  useEffect(() => {
    if (!product || lastViewed.current === product.id) return;
    lastViewed.current = product.id;
    track('product_view', {
      product_id: String(product.id),
      product_name: product.title,
      category: product.category,
      brand: product.brand,
      price: product.price,
    });
    rememberViewed(product.id);
  }, [product]);

  const related = useMemo(
    () => (product ? products.filter((p) => p.category === product.category && p.id !== product.id) : []),
    [product],
  );
  const alsoBought = useMemo(
    () => (product ? products.filter((p) => p.category !== product.category && p.tags?.some((t) => product.tags?.includes(t))).slice(0, 15) : []),
    [product],
  );

  if (!product) return <NotFound />;

  const was = originalPrice(product);
  const off = Math.round(product.discountPercentage);

  return (
    <div className="product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/" data-track="breadcrumb">
              Home
            </Link>
          </li>
          <li>
            <Link to={`/category/${product.category}`} data-track="breadcrumb">
              {categoryLabel(product.category)}
            </Link>
          </li>
          <li aria-current="page">{product.title}</li>
        </ol>
      </nav>

      <div className="product-layout">
        <Gallery key={product.id} product={product} />

        <section className="product-info" aria-labelledby="product-title">
          <h1 id="product-title">{product.title}</h1>
          <Link to={`/search?q=${encodeURIComponent(product.brand)}`} className="link brand-link" data-track="brand-link">
            Visit the {product.brand} Store
          </Link>
          <a href="#reviews-title" className="rating-link" data-track="rating-link">
            <span>{product.rating.toFixed(1)}</span>
            <Stars rating={product.rating} />
            <span className="link">{ratingCount(product).toLocaleString('en-US')} ratings</span>
          </a>
          {off >= 15 && <span className="deal-label">Limited time deal</span>}
          <hr />
          <div className="price-block">
            {off > 0 && <span className="price-off">-{off}%</span>}
            <Price value={product.price} size="xl" />
          </div>
          {was && (
            <p className="muted small">
              List Price: <s>{formatPrice(was)}</s>
            </p>
          )}
          {isFast(product) && <FastBadge />}
          <p className="small">Free returns on eligible orders. Pay over time with 0% APR on orders over $250.</p>
          <hr />
          <table className="product-facts">
            <tbody>
              <tr>
                <th scope="row">Brand</th>
                <td>{product.brand}</td>
              </tr>
              <tr>
                <th scope="row">Category</th>
                <td>{categoryLabel(product.category)}</td>
              </tr>
              <tr>
                <th scope="row">Availability</th>
                <td>{product.availabilityStatus}</td>
              </tr>
              <tr>
                <th scope="row">Warranty</th>
                <td>{product.warrantyInformation}</td>
              </tr>
            </tbody>
          </table>
          <hr />
          <h2 className="about-title">About this item</h2>
          <ul className="about-list">
            <li>{product.description}</li>
            <li>
              <Truck size={14} aria-hidden="true" /> {product.shippingInformation}.
            </li>
            <li>
              <ShieldCheck size={14} aria-hidden="true" /> {product.warrantyInformation}.
            </li>
            <li>
              <RotateCcw size={14} aria-hidden="true" /> {product.returnPolicy}.
            </li>
            {product.tags?.length > 0 && <li>Tags: {product.tags.join(', ')}.</li>}
          </ul>
        </section>

        <BuyBox key={product.id} product={product} />
      </div>

      <ProductRow title="Customers also viewed" products={related} link={`/category/${product.category}`} id="also-viewed" />
      <Reviews key={product.id} product={product} />
      {alsoBought.length > 0 && <ProductRow title="Frequently bought with similar items" products={alsoBought} id="also-bought" />}
    </div>
  );
}
