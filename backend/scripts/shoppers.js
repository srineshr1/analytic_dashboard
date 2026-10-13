// Synthetic ShopVerse shoppers. Shared by seed.js (historical data) and simulate.js (live traffic).
//
// Each session follows a persona (bouncer, browser, searcher, cart abandoner, buyer) through the
// store's real routes. Clicks are placed inside real element boxes captured from the built store
// (store-layouts.json), so heatmaps line up with the page underneath.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(readFileSync(path.join(DIR, '..', '..', 'store', 'src', 'data', 'products.json'), 'utf8'));
const LAYOUTS = JSON.parse(readFileSync(path.join(DIR, 'store-layouts.json'), 'utf8')).pages;

// ---------- random helpers ----------
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    between: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [v, w] of pairs) if ((x -= w) <= 0) return v;
      return pairs[pairs.length - 1][0];
    },
  };
  return r;
}

// ---------- catalog ----------
const categoryLabel = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const CATEGORIES = [...new Set(products.map((p) => p.category))];
const byCategory = new Map(CATEGORIES.map((c) => [c, products.filter((p) => p.category === c)]));

// Popular categories get more traffic.
const CATEGORY_WEIGHT = {
  smartphones: 10, laptops: 9, 'mobile-accessories': 7, beauty: 7, fragrances: 6, 'womens-dresses': 6,
  'mens-shirts': 5, 'mens-shoes': 5, 'womens-shoes': 5, 'womens-bags': 5, 'mens-watches': 4, 'womens-watches': 4,
  tablets: 4, 'kitchen-accessories': 4, 'home-decoration': 4, furniture: 3, 'skin-care': 4, groceries: 3,
  'sports-accessories': 3, sunglasses: 3, tops: 3, 'womens-jewellery': 3, motorcycle: 1, vehicle: 1,
};
// Stable per-product popularity (rating-driven with deterministic noise).
// Expensive items (cars, motorcycles) get views but far fewer purchases.
const popularity = new Map(products.map((p) => [p.id, (Math.pow(p.rating, 2.2) * (0.4 + ((p.id * 2654435761) % 1000) / 1000)) / Math.sqrt(1 + p.price / 150)]));

function matches(p, query) {
  const q = query.trim().toLowerCase();
  const hay = [p.title, p.brand, p.category, categoryLabel(p.category), ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t));
}
const searchCount = (q) => products.filter((p) => matches(p, q)).length;

const QUERIES = [
  ['iphone', 8], ['laptop', 8], ['phone', 7], ['watch', 7], ['perfume', 6], ['shoes', 6], ['dress', 5],
  ['samsung', 5], ['apple', 5], ['sunglasses', 4], ['lipstick', 3], ['bag', 4], ['shirt', 4], ['sofa', 2],
  ['kitchen', 3], ['headphones', 3], ['nike', 3], ['tablet', 3], ['mascara', 2], ['chair', 2],
  // Things the store doesn't carry: show up as zero-result searches.
  ['ps5', 2], ['airpods pro 3', 2], ['nintendo switch', 2], ['gift card', 2], ['4k tv', 2], ['gaming mouse', 1],
];

function pickProduct(rng, category) {
  const pool = category ? byCategory.get(category) : products;
  return rng.weighted(pool.map((p) => [p, popularity.get(p.id)]));
}
const pickCategory = (rng) => rng.weighted(CATEGORIES.map((c) => [c, CATEGORY_WEIGHT[c] || 2]));

// ---------- devices & browsers ----------
const UAS = {
  desktop: [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 55],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15', 18],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', 14],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 13],
  ],
  tablet: [
    ['Mozilla/5.0 (iPad; CPU OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', 70],
    ['Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 30],
  ],
  mobile: [
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', 52],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', 42],
    ['Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36', 6],
  ],
};
const VIEWPORT_HEIGHTS = { desktop: [800, 720, 900, 1000], tablet: [1180, 1024], mobile: [844, 800, 915, 760] };

const REFERRERS = [
  ['', 40], ['https://www.google.com/', 32], ['https://www.instagram.com/', 9], ['https://www.facebook.com/', 7],
  ['https://t.co/', 3], ['https://www.bing.com/', 4], ['https://mail.google.com/', 5],
];

const PERSONAS = [
  ['bouncer', 30], ['browser', 30], ['searcher', 16], ['abandoner', 15], ['buyer', 9],
];

// Expected max scroll depth per page type (fraction of sessions reaching deeper levels decays).
const SCROLL_PROFILE = {
  '/store': 0.62, '/store/search': 0.55, '/store/category/:slug': 0.55, '/store/deals': 0.5,
  '/store/product/:id': 0.6, '/store/cart': 0.75, '/store/checkout': 0.7, '/store/order/:id': 0.6,
};

/**
 * Builds one synthetic session.
 * Returns { session_id, user_agent, events: [{ ...raw event, timestamp: Date }] } with events
 * in chronological order starting at `start`.
 */
export function generateSession(rng, { baseUrl = 'http://localhost:4000', start = new Date(), persona } = {}) {
  persona ??= rng.weighted(PERSONAS);
  const device = rng.weighted([['desktop', 55], ['mobile', 38], ['tablet', 7]]);
  const user_agent = rng.weighted(UAS[device]);
  const session_id = randomUUID();
  const layoutsFor = (group) => LAYOUTS[group]?.[device] || LAYOUTS[group]?.desktop;
  const vh = rng.pick(VIEWPORT_HEIGHTS[device]);

  let t = start.getTime();
  const events = [];
  let current = null; // { url, group, layout, enteredAt, depths }
  const cart = new Map(); // product_id -> { p, qty }

  const common = (layout) => ({
    session_id,
    viewport_width: layout.viewport_width,
    viewport_height: vh,
    page_width: layout.page_width,
    page_height: layout.page_height,
  });
  const push = (type, extra = {}) => {
    events.push({ ...common(current.layout), event_type: type, page_url: current.url, page_group: current.group, timestamp: new Date(t), ...extra });
  };
  const wait = (lo, hi) => { t += Math.round(rng.between(lo, hi) * 1000); };

  const findEls = (label) => current.layout.elements.filter((e) => e[0] === label);
  const clickEl = (el, opts = {}) => {
    const [label, fx, y, fw, h, selector] = el;
    const pw = current.layout.page_width;
    const x = Math.round((fx + fw * rng.between(0.15, 0.85)) * pw);
    const yy = Math.round(y + h * rng.between(0.2, 0.8));
    scrollTo(yy);
    push('click', { x, y: yy, target: selector, target_label: label });
    if (opts.rage) {
      for (let i = 0; i < 3; i++) {
        t += rng.int(120, 220);
        push('click', { x: x + rng.int(-6, 6), y: yy + rng.int(-6, 6), target: selector, target_label: label });
      }
      push('rage_click', { x, y: yy, target: selector, target_label: label, props: { count: 4 } });
    }
  };
  /** Click an element with the given label (preferring those near the top), if present. */
  const click = (label, opts) => {
    const els = findEls(label);
    if (!els.length) return false;
    const el = opts?.any ? rng.pick(els) : els[Math.min(els.length - 1, Math.floor(Math.pow(rng.next(), 2.2) * els.length))];
    clickEl(el, opts);
    return true;
  };
  // Scroll far enough to see y, emitting depth milestones.
  const scrollTo = (y) => {
    const pct = Math.min(100, ((y + vh * 0.5) / current.layout.page_height) * 100 + 0.01);
    reachDepth(pct);
  };
  const reachDepth = (pct) => {
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m && !current.depths.has(m)) {
        current.depths.add(m);
        events.push({ ...common(current.layout), event_type: 'scroll_depth', page_url: current.url, page_group: current.group, timestamp: new Date(t), props: { depth: m } });
      }
    }
  };
  // Random exploring: scroll and maybe a couple of incidental clicks.
  const browse = (intensity = 1) => {
    const profile = SCROLL_PROFILE[current.group] ?? 0.5;
    let depth = (vh / current.layout.page_height) * 100;
    while (rng.chance(profile * intensity) && depth < 100) depth += rng.between(15, 35);
    wait(2, 6);
    reachDepth(depth);
    if (rng.chance(0.35 * intensity)) {
      const el = rng.pick(current.layout.elements.filter((e) => !/^(checkout|place-order|nav-cart|proceed)/.test(e[0])));
      if (el) { clickEl(el); wait(1, 4); }
    }
  };

  const navigate = (group, url, { referrer } = {}) => {
    if (current) {
      const ms = t - current.enteredAt;
      if (ms > 500) push('time_on_page', { props: { duration_ms: ms } });
    }
    t += rng.int(200, 900);
    const layout = layoutsFor(group);
    current = { url: `${baseUrl}${url}`, group, layout, enteredAt: t, depths: new Set() };
    push('page_view', referrer ? { referrer } : {});
    t += rng.int(300, 1200);
    reachDepth((vh / layout.page_height) * 100);
  };
  const leave = () => {
    if (!current) return;
    wait(2, 20);
    const ms = t - current.enteredAt;
    if (ms > 500) push('time_on_page', { props: { duration_ms: ms } });
  };

  const viewProduct = (p) => {
    navigate('/store/product/:id', `/store/product/${p.id}`);
    push('product_view', { props: { product_id: String(p.id), product_name: p.title, category: p.category, brand: p.brand, price: p.price } });
    wait(3, 12);
    if (rng.chance(0.45)) { click('gallery-thumb', { any: true }); wait(1, 4); }
    browse(1.1);
    if (rng.chance(0.2)) { click('review-helpful', { any: true }); wait(1, 3); }
  };
  const addToCart = (p) => {
    // Big-ticket items are mostly window shopping: swap for a cheaper item from the same category.
    if (p.price > 5000 || (p.price > 2500 && rng.chance(0.9))) {
      p = pickProduct(rng, byCategory.get(p.category).some((x) => x.price < 2500) ? p.category : 'smartphones');
      if (p.price > 2500) return;
      click('product-card', { any: true });
      viewProduct(p);
    }
    wait(2, 10);
    const qty = rng.chance(0.18) ? 2 : 1;
    if (qty > 1) { click('qty-increase'); wait(0.5, 2); }
    // A few shoppers hammer the button when the toast is slow to appear.
    click('add-to-cart', { rage: rng.chance(0.06) });
    push('add_to_cart', { props: { product_id: String(p.id), product_name: p.title, category: p.category, brand: p.brand, price: p.price, quantity: qty } });
    const line = cart.get(p.id) || { p, qty: 0 };
    line.qty += qty;
    cart.set(p.id, line);
  };
  const toProductFromListing = (p) => {
    if (!click('product-card') && !click('deal-card')) click('category-tile');
    wait(1, 3);
    viewProduct(p);
  };
  const search = () => {
    const q = rng.weighted(QUERIES);
    click('search-input'); wait(2, 6);
    if (!click(rng.chance(0.3) ? 'search-suggestion' : 'search-submit')) click('search-submit');
    const results = searchCount(q);
    push('search', { props: { query: q, results } });
    navigate('/store/search', `/store/search?q=${encodeURIComponent(q)}`);
    browse(results ? 1 : 0.3);
    if (!results) return null;
    const hits = products.filter((p) => matches(p, q));
    return rng.weighted(hits.map((p) => [p, popularity.get(p.id)]));
  };
  const enterListing = () => {
    if (rng.chance(0.3)) {
      click('nav-deals') || click('hero-cta');
      navigate('/store/deals', '/store/deals');
      browse();
      const deals = products.filter((p) => p.discountPercentage >= 15);
      return rng.weighted(deals.map((p) => [p, popularity.get(p.id)]));
    }
    const cat = pickCategory(rng);
    click(rng.chance(0.5) ? 'category-tile' : 'nav-category') || click('hero-cta');
    navigate('/store/category/:slug', `/store/category/${cat}`);
    if (rng.chance(0.35)) { click(rng.pick(['filter-brand', 'filter-price', 'filter-rating', 'sort-select']), { any: true }); wait(2, 5); }
    browse();
    return pickProduct(rng, cat);
  };
  const goCart = () => {
    wait(2, 8);
    click('nav-cart');
    navigate('/store/cart', '/store/cart');
    wait(3, 15);
    browse(0.6);
  };
  const cartValue = () => Math.round([...cart.values()].reduce((s, l) => s + l.p.price * l.qty, 0) * 100) / 100;
  const cartCount = () => [...cart.values()].reduce((s, l) => s + l.qty, 0);
  const checkout = (complete) => {
    if (!cart.size) return;
    click('proceed-to-checkout');
    navigate('/store/checkout', '/store/checkout');
    push('begin_checkout', { props: { value: cartValue(), items_count: cartCount() } });
    const steps = complete ? 3 : rng.int(0, 2);
    for (let i = 0; i < steps; i++) {
      wait(8, 40);
      // The payment step occasionally frustrates people.
      click('checkout-continue', { rage: i === 2 && rng.chance(0.08) });
    }
    if (!complete) return;
    wait(4, 15);
    click('place-order');
    const order_id = `SV-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    push('purchase', {
      props: {
        order_id,
        value: cartValue(),
        items_count: cartCount(),
        items: [...cart.values()].map((l) => ({ product_id: String(l.p.id), name: l.p.title, category: l.p.category, price: l.p.price, quantity: l.qty })),
      },
    });
    navigate('/store/order/:id', `/store/order/${order_id}`);
    browse(0.5);
    if (rng.chance(0.3)) { click('continue-shopping'); }
  };

  // ---------- entry ----------
  const referrer = rng.weighted(REFERRERS) || undefined;
  const entry = rng.weighted([['home', 62], ['product', 18], ['category', 12], ['deals', 8]]);
  let landing = null;
  if (entry === 'product') {
    landing = pickProduct(rng);
    navigate('/store/product/:id', `/store/product/${landing.id}`, { referrer });
    push('product_view', { props: { product_id: String(landing.id), product_name: landing.title, category: landing.category, brand: landing.brand, price: landing.price } });
  } else if (entry === 'category') {
    const cat = pickCategory(rng);
    navigate('/store/category/:slug', `/store/category/${cat}`, { referrer });
    landing = pickProduct(rng, cat);
  } else if (entry === 'deals') {
    navigate('/store/deals', '/store/deals', { referrer });
  } else {
    navigate('/store', '/store', { referrer });
    if (rng.chance(0.25)) { click(rng.pick(['hero-next', 'hero-prev', 'hero-dot'])); wait(1, 3); }
  }

  if (persona === 'bouncer') {
    browse(0.5);
    leave();
    return { session_id, user_agent, device, persona, events };
  }

  // ---------- browsing ----------
  const productViews = persona === 'browser' ? rng.int(1, 4) : rng.int(1, 3);
  let lastProduct = entry === 'product' ? landing : null;
  for (let i = 0; i < productViews; i++) {
    let p = null;
    if (persona === 'searcher' || (persona !== 'browser' && rng.chance(0.3)) || (persona === 'browser' && rng.chance(0.15))) {
      p = search();
      if (!p) { if (persona === 'searcher' && rng.chance(0.5)) break; continue; }
      toProductFromListing(p);
    } else if (lastProduct && rng.chance(0.4)) {
      // "Customers also viewed" on the product page.
      p = pickProduct(rng, lastProduct.category);
      click('product-card', { any: true });
      wait(1, 2);
      viewProduct(p);
    } else if (current.group === '/store/category/:slug' && landing && i === 0) {
      toProductFromListing(landing);
      p = landing;
    } else {
      if (current.group !== '/store') {
        click('logo');
        navigate('/store', '/store');
        browse(0.6);
      }
      p = enterListing();
      toProductFromListing(p);
    }
    lastProduct = p;
    if (persona === 'searcher' && rng.chance(0.25)) addToCart(p);
  }

  if (persona === 'abandoner' || persona === 'buyer') {
    if (!lastProduct) {
      lastProduct = pickProduct(rng);
      viewProduct(lastProduct);
    }
    if (current.group !== '/store/product/:id') viewProduct(lastProduct);
    addToCart(lastProduct);
    if (rng.chance(0.25)) {
      const extra = pickProduct(rng, lastProduct.category);
      click('product-card', { any: true });
      viewProduct(extra);
      addToCart(extra);
    }
    if (persona === 'buyer' || rng.chance(0.7)) goCart();
    if (current.group === '/store/cart' && rng.chance(0.15)) click(rng.pick(['cart-remove', 'cart-save-later']), { any: true });
    if (persona === 'buyer') checkout(true);
    else if (current.group === '/store/cart' && rng.chance(0.45)) checkout(false);
  } else if (cart.size && rng.chance(0.3)) {
    goCart();
  }

  leave();
  events.sort((a, b) => a.timestamp - b.timestamp);
  return { session_id, user_agent, device, persona, events };
}

/** Hour-of-day traffic weights (local evening peak). */
export const HOUR_WEIGHTS = [2, 1.2, 0.8, 0.6, 0.6, 0.9, 1.6, 2.6, 3.4, 3.8, 4, 4.2, 4.6, 4.4, 4.2, 4.3, 4.6, 5, 5.8, 6.6, 7, 6.4, 5, 3.4];
