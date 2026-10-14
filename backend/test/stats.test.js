import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Event } from '../src/models/Event.js';
import { validateEvent } from '../src/validate.js';

let mongod;
let app;

const SID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SID_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const SID_C = 'cccccccc-0000-4000-8000-000000000003';
const ORIGIN = 'http://shop.test';
const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const ev = (o) => ({ page_url: `${ORIGIN}/store`, timestamp: at(60e3), viewport_width: 1280, ...o });
const post = (events) => request(app).post('/api/events').send(events).expect(201);

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('stats'));
  await Event.syncIndexes();
  app = createApp({ spaDirs: {} });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Event.deleteMany({});
});

/**
 * A: home → product → add to cart → checkout → purchase ($50), desktop
 * B: home → search → product → add to cart (abandons), mobile
 * C: home only (bounce), desktop, 10 days ago (outside 7d window)
 */
async function seedJourneys() {
  const P = `${ORIGIN}/store/product/7`;
  await post([
    ev({ session_id: SID_A, event_type: 'page_view', timestamp: at(600e3) }),
    ev({ session_id: SID_A, event_type: 'click', x: 100, y: 200, target: 'a.card', target_label: 'product-card', timestamp: at(590e3) }),
    ev({ session_id: SID_A, event_type: 'page_view', page_url: P, page_group: '/store/product/:id', timestamp: at(580e3) }),
    ev({ session_id: SID_A, event_type: 'product_view', page_url: P, page_group: '/store/product/:id', props: { product_id: '7', product_name: 'Phone', category: 'smartphones', price: 25 }, timestamp: at(579e3) }),
    ev({ session_id: SID_A, event_type: 'scroll_depth', page_url: P, page_group: '/store/product/:id', props: { depth: 75 }, timestamp: at(575e3) }),
    ev({ session_id: SID_A, event_type: 'add_to_cart', page_url: P, page_group: '/store/product/:id', props: { product_id: '7', product_name: 'Phone', category: 'smartphones', price: 25, quantity: 2 }, timestamp: at(570e3) }),
    ev({ session_id: SID_A, event_type: 'time_on_page', page_url: P, page_group: '/store/product/:id', props: { duration_ms: 12000 }, timestamp: at(565e3) }),
    ev({ session_id: SID_A, event_type: 'page_view', page_url: `${ORIGIN}/store/checkout`, timestamp: at(560e3) }),
    ev({ session_id: SID_A, event_type: 'begin_checkout', page_url: `${ORIGIN}/store/checkout`, props: { value: 50, items_count: 2 }, timestamp: at(559e3) }),
    ev({ session_id: SID_A, event_type: 'purchase', page_url: `${ORIGIN}/store/checkout`, props: { order_id: 'o1', value: 50, items_count: 2, items: [{ product_id: '7', name: 'Phone', category: 'smartphones', price: 25, quantity: 2 }] }, timestamp: at(550e3) }),

    ev({ session_id: SID_B, viewport_width: 390, event_type: 'page_view', timestamp: at(300e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'search', page_url: `${ORIGIN}/store/search?q=phone`, props: { query: 'Phone', results: 3 }, timestamp: at(295e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'search', page_url: `${ORIGIN}/store/search?q=zzz`, props: { query: 'zzz', results: 0 }, timestamp: at(294e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'page_view', page_url: `${ORIGIN}/store/search?q=phone`, timestamp: at(290e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'page_view', page_url: `${ORIGIN}/store/product/7`, page_group: '/store/product/:id', timestamp: at(280e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'product_view', page_url: `${ORIGIN}/store/product/7`, page_group: '/store/product/:id', props: { product_id: '7', product_name: 'Phone', category: 'smartphones', price: 25 }, timestamp: at(279e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'add_to_cart', page_url: `${ORIGIN}/store/product/7`, page_group: '/store/product/:id', props: { product_id: '7', price: 25, quantity: 1 }, timestamp: at(270e3) }),
    ev({ session_id: SID_B, viewport_width: 390, event_type: 'rage_click', x: 10, y: 10, target_label: 'add-to-cart', page_url: `${ORIGIN}/store/product/7`, page_group: '/store/product/:id', props: { count: 4 }, timestamp: at(269e3) }),

  ]);
  // C is 10 days old: older than ingest accepts, so insert it directly (like the seeder).
  const { event } = validateEvent(ev({ session_id: SID_C, event_type: 'page_view', timestamp: at(10 * 86400e3) }), 'test', { checkSkew: false });
  await Event.create(event);
}

test('validation: per-type props, groups, device, protocol', async () => {
  const res = await request(app)
    .post('/api/events')
    .send([
      ev({ session_id: SID_A, event_type: 'search', props: { query: 'Shoes', results: 4, evil: { $gt: 1 } } }),
      ev({ session_id: SID_A, event_type: 'search' }), // missing query
      ev({ session_id: SID_A, event_type: 'purchase', props: {} }), // missing value
      ev({ session_id: SID_A, event_type: 'page_view', page_url: 'javascript:alert(1)' }),
      ev({ session_id: SID_A, event_type: 'rage_click' }), // missing coords
      ev({ session_id: SID_A, event_type: 'page_view', page_url: `${ORIGIN}/store/product/3`, page_group: '/store/product/:id', viewport_width: 400 }),
      ev({ session_id: SID_A, event_type: 'page_view', page_url: `${ORIGIN}/x/`, page_group: 'not-a-path' }),
    ])
    .expect(201);
  assert.equal(res.body.accepted, 3);
  assert.deepEqual(res.body.errors.map((e) => e.index), [1, 2, 3, 4]);

  const docs = await Event.find().sort({ _id: 1 }).lean();
  assert.equal(docs[0].props.query, 'shoes'); // normalised
  assert.equal(docs[0].props.evil, undefined);
  assert.equal(docs[1].page_key, `${ORIGIN}/store/product/:id`);
  assert.equal(docs[1].device, 'mobile');
  assert.equal(docs[2].page_group, '/x'); // invalid group falls back to the path
});

test('GET /api/stats/overview: KPIs, window and previous period', async () => {
  await seedJourneys();
  const { body } = await request(app).get('/api/stats/overview?range=7d').expect(200);
  assert.equal(body.current.sessions, 2);
  assert.equal(body.current.orders, 1);
  assert.equal(body.current.revenue, 50);
  assert.equal(body.current.conversion_rate, 50);
  assert.equal(body.current.rage_clicks, 1);
  assert.equal(body.current.bounce_rate, 0);
  assert.equal(body.previous.sessions, 1); // C, 10 days ago

  const all = await request(app).get('/api/stats/overview?range=all').expect(200);
  assert.equal(all.body.current.sessions, 3);
  assert.equal(all.body.current.bounce_rate, 33.3);
  assert.equal(all.body.previous, null);

  const mobile = await request(app).get('/api/stats/overview?range=7d&device=mobile').expect(200);
  assert.equal(mobile.body.current.sessions, 1);
});

test('GET /api/stats/funnel counts sessions step by step', async () => {
  await seedJourneys();
  const { body } = await request(app).get('/api/stats/funnel?range=7d').expect(200);
  assert.deepEqual(body.steps.map((s) => s.sessions), [2, 2, 2, 1, 1]);
  assert.equal(body.steps[3].rate_from_prev, 50);
  assert.equal(body.steps[3].drop_off, 1);
});

test('GET /api/stats/flows builds an acyclic step graph and transitions', async () => {
  await seedJourneys();
  const { body } = await request(app).get('/api/stats/flows?range=7d').expect(200);
  assert.equal(body.sessions, 2);
  for (const l of body.links) assert.ok(body.nodes[l.target].step > body.nodes[l.source].step);
  const t = body.transitions.find((x) => x.from === '/store' && x.to === '/store/product/:id');
  assert.equal(t.count, 1);
});

test('GET /api/stats/pages, clicks, search, products, devices, scroll', async () => {
  await seedJourneys();
  const pages = (await request(app).get('/api/stats/pages?range=7d').expect(200)).body.pages;
  const product = pages.find((p) => p.page_group === '/store/product/:id');
  assert.equal(product.views, 2);
  assert.equal(product.avg_time_ms, 12000);
  assert.equal(product.avg_scroll, 75);
  assert.equal(pages.find((p) => p.page_group === '/store').entries, 2);

  const clicks = (await request(app).get('/api/stats/clicks?range=7d').expect(200)).body;
  assert.equal(clicks.top[0].label, 'product-card');
  assert.equal(clicks.rage[0].label, 'add-to-cart');

  const search = (await request(app).get('/api/stats/search?range=7d').expect(200)).body;
  assert.equal(search.total, 2);
  assert.equal(search.zero_result_rate, 50);
  assert.equal(search.zero_results[0].query, 'zzz');

  const products = (await request(app).get('/api/stats/products?range=7d').expect(200)).body;
  const phone = products.top_viewed[0];
  assert.deepEqual([phone.product_id, phone.views, phone.add_to_cart, phone.units_sold, phone.revenue], ['7', 2, 2, 2, 50]);
  assert.equal(products.categories[0].category, 'smartphones');

  const devices = (await request(app).get('/api/stats/devices?range=7d').expect(200)).body;
  assert.deepEqual(devices.devices.map((d) => d.name).sort(), ['desktop', 'mobile']);

  const scroll = (await request(app).get('/api/stats/scroll').query({ page_url: `${ORIGIN}/store/product/:id`, range: '7d' }).expect(200)).body;
  assert.equal(scroll.sessions, 2);
  assert.deepEqual(scroll.levels.map((l) => l.pct), [100, 50, 50, 50, 0]);
});

test('GET /api/stats/timeseries fills empty buckets', async () => {
  await seedJourneys();
  const { body } = await request(app).get('/api/stats/timeseries?range=24h').expect(200);
  assert.equal(body.interval, 'hour');
  assert.ok(body.points.length >= 24);
  assert.equal(body.points.reduce((s, p) => s + p.orders, 0), 1);
});

test('GET /api/sessions filters and enriches; /api/live; heatmap by group', async () => {
  await seedJourneys();
  const conv = (await request(app).get('/api/sessions?converted=1').expect(200)).body;
  assert.equal(conv.total, 1);
  assert.equal(conv.sessions[0].revenue, 50);
  assert.equal((await request(app).get('/api/sessions?device=mobile').expect(200)).body.sessions[0].session_id, SID_B);
  assert.equal((await request(app).get('/api/sessions?q=cccc').expect(200)).body.total, 1);
  assert.equal((await request(app).get('/api/sessions?q=(.*').expect(200)).body.total, 0); // regex is escaped

  const live = (await request(app).get('/api/live').expect(200)).body;
  assert.equal(live.recent.length, 19);
  assert.equal(live.recent.find((e) => e.event_type === 'page_view').props, undefined); // no empty props/items
  assert.equal(live.active_sessions, 1); // only B was active in the last 5 minutes
  assert.equal(live.sessions[0].session_id, SID_B);

  const heat = (await request(app).get('/api/heatmap').query({ page_url: `${ORIGIN}/store/product/:id`, type: 'rage_click' }).expect(200)).body;
  assert.equal(heat.count, 1);
  const pages = (await request(app).get('/api/pages').expect(200)).body.pages;
  assert.ok(pages.find((p) => p.page_url === `${ORIGIN}/store/product/:id`).sample_url.endsWith('/store/product/7'));
});

test('unbuilt SPA returns a helpful 503; landing page is served', async () => {
  const appWithDirs = createApp({ spaDirs: { store: '/nonexistent/store' }, files: {} });
  const res = await request(appWithDirs).get('/store/product/1').expect(503);
  assert.match(res.text, /npm run build/);
  await request(appWithDirs).get('/').expect(200).expect(/ShopVerse/);
});

test('ingest rejects out-of-range timestamps and over-long page groups', async () => {
  const res = await request(app)
    .post('/api/events')
    .send([
      ev({ session_id: SID_A, event_type: 'page_view', timestamp: '2099-01-01T00:00:00Z' }),
      ev({ session_id: SID_A, event_type: 'page_view', timestamp: true }),
      ev({ session_id: SID_A, event_type: 'page_view', timestamp: at(30 * 86400e3) }),
      ev({ session_id: SID_A, event_type: 'page_view', page_url: `${ORIGIN}/${'%41'.repeat(700)}` }),
      ev({ session_id: SID_A, event_type: 'page_view' }),
    ])
    .expect(201);
  assert.equal(res.body.accepted, 1);
  assert.deepEqual(res.body.errors.map((e) => e.index), [0, 1, 2, 3]);
  assert.equal(await Event.countDocuments(), 1);
});
