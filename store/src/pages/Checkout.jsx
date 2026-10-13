import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CreditCard, Lock, MapPin, Package, Truck, Wallet } from 'lucide-react';
import { useCart } from '../CartContext.jsx';
import { track } from '../analytics.js';
import { deliveryDate, formatPrice } from '../catalog.js';
import { newOrderId, saveOrder } from '../orders.js';
import { FREE_SHIPPING_MIN } from './Cart.jsx';
import { usePageTitle } from '../usePageTitle.js';

const STEPS = [
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'delivery', label: 'Delivery', icon: Truck },
  { key: 'payment', label: 'Payment', icon: CreditCard },
  { key: 'review', label: 'Review', icon: Package },
];

const TAX_RATE = 0.08;
const round2 = (n) => Math.round(n * 100) / 100;

export function deliveryOptions(subtotal) {
  return [
    { id: 'standard', label: 'Standard delivery', days: 5, price: subtotal >= FREE_SHIPPING_MIN ? 0 : 5.99 },
    { id: 'fast', label: 'ShopVerse Fast', days: 2, price: subtotal >= FREE_SHIPPING_MIN ? 0 : 9.99 },
    { id: 'next-day', label: 'Next-day delivery', days: 1, price: 14.99 },
  ];
}

const DEMO_ADDRESS = {
  fullName: 'Alex Morgan',
  phone: '+1 555 0134',
  line1: '221 Market Street, Apt 4B',
  city: 'San Francisco',
  state: 'CA',
  zip: '94105',
  country: 'United States',
};

function Field({ id, label, value, onChange, autoComplete, required = true, type = 'text', pattern, inputMode, className }) {
  return (
    <div className={`field ${className || ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        pattern={pattern}
        inputMode={inputMode}
        data-track={`checkout-field-${id}`}
      />
    </div>
  );
}

function Stepper({ step, onStep }) {
  return (
    <ol className="stepper" aria-label="Checkout progress">
      {STEPS.map((s, i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'todo';
        const Icon = s.icon;
        const inner = (
          <>
            <span className="stepper-dot" aria-hidden="true">
              {state === 'done' ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
            </span>
            <span className="stepper-label">
              <span className="visually-hidden">Step {i + 1}: </span>
              {s.label}
              {state === 'done' && <span className="visually-hidden"> (completed)</span>}
            </span>
          </>
        );
        return (
          <li key={s.key} className={`stepper-item ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            {state === 'done' ? (
              <button type="button" onClick={() => onStep(i)} data-track="checkout-step">
                {inner}
              </button>
            ) : (
              <span>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function Checkout() {
  const { lines, count, subtotal, clear } = useCart();
  const navigate = useNavigate();
  usePageTitle('Checkout');

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(DEMO_ADDRESS);
  const [deliveryId, setDeliveryId] = useState('fast');
  const [payment, setPayment] = useState({ method: 'card', name: DEMO_ADDRESS.fullName, number: '4242 4242 4242 4242', expiry: '12/29', cvc: '123' });
  const [placing, setPlacing] = useState(false);
  const headingRef = useRef(null);

  // begin_checkout once per visit, only with a non-empty cart.
  const began = useRef(false);
  useEffect(() => {
    if (began.current || !lines.length) return;
    began.current = true;
    track('begin_checkout', { value: subtotal, items_count: count });
  }, [lines.length, subtotal, count]);

  // Move focus to the step heading so keyboard/screen-reader users land on the new step.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  if (!lines.length && !placing) {
    return (
      <div className="checkout-page">
        <section className="card-panel cart-empty">
          <div>
            <h1>Your cart is empty</h1>
            <p>Add some items to your cart before checking out.</p>
            <Link to="/" className="btn btn-yellow" data-track="continue-shopping">
              Continue shopping
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const options = deliveryOptions(subtotal);
  const delivery = options.find((o) => o.id === deliveryId) || options[0];
  const shipping = delivery.price;
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + shipping + tax);
  const setAddr = (k) => (v) => setAddress((a) => ({ ...a, [k]: v }));
  const setPay = (k) => (v) => setPayment((p) => ({ ...p, [k]: v }));

  function next(e) {
    e.preventDefault();
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function placeOrder() {
    if (placing) return;
    setPlacing(true);
    const id = newOrderId();
    const items = lines.map((l) => ({
      product_id: String(l.product.id),
      name: l.product.title,
      category: l.product.category,
      price: l.product.price,
      quantity: l.qty,
    }));
    saveOrder({
      id,
      createdAt: new Date().toISOString(),
      items: lines.map((l) => ({ ...items.find((i) => i.product_id === String(l.product.id)), thumbnail: l.product.thumbnail })),
      address,
      delivery: { ...delivery, date: deliveryDate(delivery.days) },
      payment: payment.method === 'card' ? `Card ending in ${payment.number.replace(/\D/g, '').slice(-4)}` : payment.method === 'upi' ? 'UPI' : 'Pay on delivery',
      subtotal,
      shipping,
      tax,
      total,
      itemsCount: count,
    });
    track('purchase', { order_id: id, value: subtotal, items_count: count, items });
    clear();
    navigate(`/order/${id}`, { replace: true });
  }

  const back = (
    <button type="button" className="btn btn-outline" onClick={() => setStep((s) => Math.max(0, s - 1))} data-track="checkout-back">
      Back
    </button>
  );

  return (
    <div className="checkout-page">
      <div className="checkout-title">
        <h1>
          Checkout <span className="muted">({count} item{count === 1 ? '' : 's'})</span>
        </h1>
        <span className="secure">
          <Lock size={16} aria-hidden="true" /> Secure checkout
        </span>
      </div>
      <Stepper step={step} onStep={setStep} />

      <div className="checkout-layout">
        <section className="card-panel checkout-step" aria-labelledby="step-heading">
          <h2 id="step-heading" ref={headingRef} tabIndex={-1}>
            {step + 1}. {['Shipping address', 'Choose a delivery option', 'Payment method', 'Review your order'][step]}
          </h2>

          {step === 0 && (
            <form onSubmit={next} className="form-grid">
              <Field id="fullName" label="Full name" value={address.fullName} onChange={setAddr('fullName')} autoComplete="name" className="span-2" />
              <Field id="phone" label="Phone number" type="tel" value={address.phone} onChange={setAddr('phone')} autoComplete="tel" className="span-2" />
              <Field id="line1" label="Street address" value={address.line1} onChange={setAddr('line1')} autoComplete="street-address" className="span-2" />
              <Field id="city" label="City" value={address.city} onChange={setAddr('city')} autoComplete="address-level2" />
              <Field id="state" label="State" value={address.state} onChange={setAddr('state')} autoComplete="address-level1" />
              <Field id="zip" label="ZIP code" value={address.zip} onChange={setAddr('zip')} autoComplete="postal-code" inputMode="numeric" pattern="[0-9A-Za-z \-]{3,10}" />
              <Field id="country" label="Country" value={address.country} onChange={setAddr('country')} autoComplete="country-name" />
              <div className="step-actions span-2">
                <Link to="/cart" className="btn btn-outline" data-track="checkout-back">
                  Back to cart
                </Link>
                <button type="submit" className="btn btn-yellow" data-track="checkout-continue">
                  Use this address
                </button>
              </div>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={next}>
              <fieldset className="option-list">
                <legend className="visually-hidden">Delivery speed</legend>
                {options.map((o) => (
                  <label key={o.id} className={`option${o.id === deliveryId ? ' selected' : ''}`}>
                    <input type="radio" name="delivery" value={o.id} checked={o.id === deliveryId} onChange={() => setDeliveryId(o.id)} data-track="checkout-delivery" />
                    <span className="option-main">
                      <strong>{deliveryDate(o.days)}</strong> — {o.label}
                    </span>
                    <span className="option-price">{o.price ? formatPrice(o.price) : 'FREE'}</span>
                  </label>
                ))}
              </fieldset>
              <div className="step-actions">
                {back}
                <button type="submit" className="btn btn-yellow" data-track="checkout-continue">
                  Continue
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={next}>
              <fieldset className="option-list">
                <legend className="visually-hidden">Payment method</legend>
                {[
                  { id: 'card', label: 'Credit or debit card', icon: CreditCard },
                  { id: 'upi', label: 'UPI / digital wallet', icon: Wallet },
                  { id: 'cod', label: 'Pay on delivery', icon: Truck },
                ].map((m) => (
                  <label key={m.id} className={`option${payment.method === m.id ? ' selected' : ''}`}>
                    <input type="radio" name="payment" value={m.id} checked={payment.method === m.id} onChange={() => setPay('method')(m.id)} data-track="checkout-payment" />
                    <m.icon size={18} aria-hidden="true" />
                    <span className="option-main">{m.label}</span>
                  </label>
                ))}
              </fieldset>
              {payment.method === 'card' && (
                <div className="form-grid card-form">
                  <Field id="cardName" label="Name on card" value={payment.name} onChange={setPay('name')} autoComplete="cc-name" className="span-2" />
                  <Field
                    id="cardNumber"
                    label="Card number"
                    value={payment.number}
                    onChange={setPay('number')}
                    autoComplete="cc-number"
                    inputMode="numeric"
                    pattern="[0-9 ]{12,23}"
                    className="span-2"
                  />
                  <Field id="cardExpiry" label="Expiry (MM/YY)" value={payment.expiry} onChange={setPay('expiry')} autoComplete="cc-exp" pattern="(0[1-9]|1[0-2])\/[0-9]{2}" />
                  <Field id="cardCvc" label="CVC" value={payment.cvc} onChange={setPay('cvc')} autoComplete="cc-csc" inputMode="numeric" pattern="[0-9]{3,4}" />
                  <p className="small muted span-2">Demo store — no payment is processed. Card details are not stored.</p>
                </div>
              )}
              <div className="step-actions">
                {back}
                <button type="submit" className="btn btn-yellow" data-track="checkout-continue">
                  Continue
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="review-step">
              <div className="review-grid">
                <div>
                  <h3>Shipping address</h3>
                  <address>
                    {address.fullName}
                    <br />
                    {address.line1}
                    <br />
                    {address.city}, {address.state} {address.zip}
                    <br />
                    {address.country}
                    <br />
                    {address.phone}
                  </address>
                  <button type="button" className="link small" onClick={() => setStep(0)} data-track="checkout-edit">
                    Change
                  </button>
                </div>
                <div>
                  <h3>Delivery</h3>
                  <p>
                    {delivery.label}
                    <br />
                    Arriving <strong>{deliveryDate(delivery.days)}</strong>
                  </p>
                  <button type="button" className="link small" onClick={() => setStep(1)} data-track="checkout-edit">
                    Change
                  </button>
                </div>
                <div>
                  <h3>Payment</h3>
                  <p>
                    {payment.method === 'card'
                      ? `Card ending in ${payment.number.replace(/\D/g, '').slice(-4)}`
                      : payment.method === 'upi'
                        ? 'UPI / digital wallet'
                        : 'Pay on delivery'}
                  </p>
                  <button type="button" className="link small" onClick={() => setStep(2)} data-track="checkout-edit">
                    Change
                  </button>
                </div>
              </div>
              <ul className="review-items">
                {lines.map((l) => (
                  <li key={l.id}>
                    <img src={l.product.thumbnail} alt="" loading="lazy" width="64" height="64" />
                    <span className="review-item-title">{l.product.title}</span>
                    <span className="muted">Qty {l.qty}</span>
                    <strong>{formatPrice(l.product.price * l.qty)}</strong>
                  </li>
                ))}
              </ul>
              <div className="step-actions">
                {back}
                <button type="button" className="btn btn-orange btn-pill" onClick={placeOrder} disabled={placing} data-track="place-order">
                  Place your order
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="card-panel order-summary" aria-label="Order summary">
          {step === 3 && (
            <button type="button" className="btn btn-orange btn-block btn-pill" onClick={placeOrder} disabled={placing} data-track="place-order">
              Place your order
            </button>
          )}
          <h2>Order Summary</h2>
          <ul className="summary-items">
            {lines.map((l) => (
              <li key={l.id}>
                <span className="summary-thumb">
                  <img src={l.product.thumbnail} alt="" loading="lazy" width="48" height="48" />
                  <span className="summary-qty" aria-label={`Quantity ${l.qty}`}>
                    {l.qty}
                  </span>
                </span>
                <span className="summary-name">{l.product.title}</span>
                <span>{formatPrice(l.product.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <dt>Items ({count}):</dt>
            <dd>{formatPrice(subtotal)}</dd>
            <dt>Shipping &amp; handling:</dt>
            <dd>{shipping ? formatPrice(shipping) : 'FREE'}</dd>
            <dt>Estimated tax:</dt>
            <dd>{formatPrice(tax)}</dd>
            <dt className="grand">Order total:</dt>
            <dd className="grand">{formatPrice(total)}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
