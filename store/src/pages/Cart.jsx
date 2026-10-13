import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import QtyControl from '../components/QtyControl.jsx';
import { FastBadge, Price, ProductRow } from '../components/Product.jsx';
import { useCart } from '../CartContext.jsx';
import { deals, formatPrice, isFast, originalPrice } from '../catalog.js';
import { usePageTitle } from '../usePageTitle.js';

export const FREE_SHIPPING_MIN = 35;

function Line({ line }) {
  const { setQty, remove, saveForLater, MAX_QTY } = useCart();
  const p = line.product;
  const was = originalPrice(p);
  return (
    <li className="cart-line">
      <Link to={`/product/${p.id}`} className="cart-line-img" data-track="cart-item" tabIndex={-1} aria-hidden="true">
        <img src={p.thumbnail} alt="" loading="lazy" width="180" height="180" />
      </Link>
      <div className="cart-line-info">
        <Link to={`/product/${p.id}`} className="cart-line-title" data-track="cart-item">
          {p.title}
        </Link>
        <p className={`stock small ${p.stock < 10 ? 'low' : 'in'}`}>{p.stock < 10 ? `Only ${p.stock} left in stock` : 'In Stock'}</p>
        {isFast(p) && <FastBadge />}
        <p className="small muted">Brand: {p.brand}</p>
        <div className="cart-line-actions">
          <QtyControl
            value={line.qty}
            max={Math.max(1, Math.min(MAX_QTY, p.stock))}
            onChange={(v) => setQty(p.id, v)}
            onRemove={() => remove(p.id)}
            label={`Quantity for ${p.title}`}
          />
          <span className="sep" aria-hidden="true" />
          <button type="button" className="link small" onClick={() => remove(p.id)} data-track="cart-remove">
            Delete
          </button>
          <span className="sep" aria-hidden="true" />
          <button type="button" className="link small" onClick={() => saveForLater(p.id)} data-track="cart-save-later">
            Save for later
          </button>
        </div>
      </div>
      <div className="cart-line-price">
        <Price value={p.price} />
        {was && (
          <p className="small muted">
            <s>{formatPrice(was)}</s>
          </p>
        )}
      </div>
    </li>
  );
}

function SavedList() {
  const { savedProducts, moveToCart, removeSaved } = useCart();
  if (!savedProducts.length) return null;
  return (
    <section className="card-panel saved" aria-labelledby="saved-title">
      <h2 id="saved-title">
        Saved for later ({savedProducts.length} item{savedProducts.length === 1 ? '' : 's'})
      </h2>
      <ul className="saved-grid">
        {savedProducts.map((p) => (
          <li key={p.id} className="saved-item">
            <Link to={`/product/${p.id}`} data-track="cart-item">
              <img src={p.thumbnail} alt="" loading="lazy" width="160" height="160" />
              <span className="saved-title">{p.title}</span>
            </Link>
            <Price value={p.price} size="sm" />
            <p className={`stock small ${p.stock > 0 ? 'in' : 'out'}`}>{p.stock > 0 ? 'In Stock' : 'Unavailable'}</p>
            <button type="button" className="btn btn-outline btn-sm btn-block" onClick={() => moveToCart(p.id)} data-track="cart-move-to-cart" disabled={p.stock <= 0}>
              Move to cart
            </button>
            <button type="button" className="link small" onClick={() => removeSaved(p.id)} data-track="saved-remove">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Cart() {
  const { lines, count, subtotal } = useCart();
  const navigate = useNavigate();
  usePageTitle('Shopping Cart');
  const remaining = Math.max(0, FREE_SHIPPING_MIN - subtotal);

  if (!lines.length) {
    return (
      <div className="cart-page">
        <div className="cart-main">
          <section className="card-panel cart-empty">
            <ShoppingCart size={96} strokeWidth={1} aria-hidden="true" />
            <div>
              <h1>Your ShopVerse Cart is empty</h1>
              <p>
                Check out <Link to="/deals" className="link" data-track="nav-deals">today's deals</Link> or keep browsing to find something you love.
              </p>
              <Link to="/" className="btn btn-yellow" data-track="continue-shopping">
                Continue shopping
              </Link>
            </div>
          </section>
          <SavedList />
          <ProductRow title="Today's deals" products={deals.slice(0, 15)} trackName="deal-card" link="/deals" />
        </div>
      </div>
    );
  }

  const checkout = (
    <button type="button" className="btn btn-yellow btn-block btn-pill" onClick={() => navigate('/checkout')} data-track="proceed-to-checkout">
      Proceed to checkout
    </button>
  );

  return (
    <div className="cart-page">
      <div className="cart-layout">
        <div className="cart-main">
          <section className="card-panel" aria-labelledby="cart-title">
            <div className="cart-head">
              <h1 id="cart-title">Shopping Cart</h1>
              <span className="muted small">Price</span>
            </div>
            <ul className="cart-lines">
              {lines.map((l) => (
                <Line key={l.id} line={l} />
              ))}
            </ul>
            <p className="cart-subtotal-line">
              Subtotal ({count} item{count === 1 ? '' : 's'}): <strong>{formatPrice(subtotal)}</strong>
            </p>
          </section>
          <SavedList />
        </div>
        <aside className="card-panel cart-summary" aria-label="Order summary">
          <div className={`free-ship ${remaining ? '' : 'ok'}`}>
            <div className="free-ship-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_MIN) * 100)}%` }} />
            </div>
            <p className="small">
              {remaining ? (
                <>
                  Add <strong>{formatPrice(remaining)}</strong> of eligible items to qualify for FREE Shipping.
                </>
              ) : (
                <>Your order qualifies for FREE Shipping.</>
              )}
            </p>
          </div>
          <p className="cart-subtotal-line">
            Subtotal ({count} item{count === 1 ? '' : 's'}): <strong>{formatPrice(subtotal)}</strong>
          </p>
          <label className="check small">
            <input type="checkbox" data-track="gift-option" /> <span>This order contains a gift</span>
          </label>
          {checkout}
          <Link to="/" className="link small center" data-track="continue-shopping">
            Continue shopping
          </Link>
        </aside>
      </div>
      <ProductRow title="Today's deals" products={deals.slice(0, 15)} trackName="deal-card" link="/deals" />
    </div>
  );
}
