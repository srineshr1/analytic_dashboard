import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Package } from 'lucide-react';
import { getOrder } from '../orders.js';
import { formatPrice, topRated } from '../catalog.js';
import { ProductRow } from '../components/Product.jsx';
import { usePageTitle } from '../usePageTitle.js';

export default function Order() {
  const { id } = useParams();
  const order = useMemo(() => getOrder(id), [id]);
  usePageTitle(order ? `Order ${order.id}` : 'Order not found');

  if (!order) {
    return (
      <div className="order-page">
        <section className="card-panel cart-empty">
          <Package size={72} strokeWidth={1} aria-hidden="true" />
          <div>
            <h1>We couldn't find order {id}</h1>
            <p>Orders are stored on the device they were placed on. It may have been placed in another browser.</p>
            <Link to="/" className="btn btn-yellow" data-track="continue-shopping">
              Continue shopping
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const placed = new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className="order-page">
      <section className="card-panel order-confirm" aria-labelledby="order-title">
        <div className="order-hero">
          <CheckCircle2 size={40} className="ok-icon" aria-hidden="true" />
          <div>
            <h1 id="order-title">Order placed, thank you!</h1>
            <p>
              Confirmation will be sent to your email. Order number <strong className="order-id">{order.id}</strong>
            </p>
            <p className="muted small">Placed on {placed}</p>
          </div>
        </div>

        <div className="order-grid">
          <div>
            <h2>Arriving {order.delivery.date}</h2>
            <p className="muted small">{order.delivery.label}</p>
            <ul className="review-items">
              {order.items.map((it) => (
                <li key={it.product_id}>
                  {it.thumbnail && <img src={it.thumbnail} alt="" loading="lazy" width="64" height="64" />}
                  <Link to={`/product/${it.product_id}`} className="review-item-title link" data-track="order-item">
                    {it.name}
                  </Link>
                  <span className="muted">Qty {it.quantity}</span>
                  <strong>{formatPrice(it.price * it.quantity)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <aside className="order-side">
            <h3>Shipping to</h3>
            <address>
              {order.address.fullName}
              <br />
              {order.address.line1}
              <br />
              {order.address.city}, {order.address.state} {order.address.zip}
              <br />
              {order.address.country}
            </address>
            <h3>Payment</h3>
            <p>{order.payment}</p>
            <dl className="totals">
              <dt>Items ({order.itemsCount}):</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
              <dt>Shipping:</dt>
              <dd>{order.shipping ? formatPrice(order.shipping) : 'FREE'}</dd>
              <dt>Tax:</dt>
              <dd>{formatPrice(order.tax)}</dd>
              <dt className="grand">Order total:</dt>
              <dd className="grand">{formatPrice(order.total)}</dd>
            </dl>
          </aside>
        </div>
        <Link to="/" className="btn btn-yellow btn-pill" data-track="continue-shopping">
          Continue shopping
        </Link>
      </section>
      <ProductRow title="Top rated picks for your next order" products={topRated} />
    </div>
  );
}
