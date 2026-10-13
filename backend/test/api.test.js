import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Event } from '../src/models/Event.js';

let mongod;
let app;

const SID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SID_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const PAGE = 'http://shop.test/products';

const ev = (o) => ({ page_url: PAGE, timestamp: new Date().toISOString(), ...o });

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('test'));
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

test('POST /api/events stores a single JSON event', async () => {
  const res = await request(app)
    .post('/api/events')
    .send(ev({ session_id: SID_A, event_type: 'page_view' }))
    .expect(201);
  assert.equal(res.body.accepted, 1);
  assert.equal(await Event.countDocuments(), 1);
});

test('POST /api/events accepts text/plain batches (sendBeacon)', async () => {
  const body = JSON.stringify({
    events: [
      ev({ session_id: SID_A, event_type: 'page_view' }),
      ev({ session_id: SID_A, event_type: 'click', x: 10, y: 20 }),
    ],
  });
  const res = await request(app).post('/api/events').set('Content-Type', 'text/plain').send(body).expect(201);
  assert.equal(res.body.accepted, 2);
});

test('POST /api/events validates input and reports partial failures', async () => {
  await request(app).post('/api/events').send({ session_id: 'x', event_type: 'page_view' }).expect(400);
  await request(app).post('/api/events').set('Content-Type', 'application/json').send('{bad').expect(400);

  const res = await request(app)
    .post('/api/events')
    .send([
      ev({ session_id: SID_A, event_type: 'click', x: 5, y: 5 }),
      ev({ session_id: SID_A, event_type: 'click' }), // missing coords
      ev({ session_id: SID_A, event_type: 'scroll' }), // unsupported type
      ev({ session_id: SID_A, event_type: 'page_view', page_url: 'not a url' }),
      ev({ session_id: SID_A, event_type: 'page_view', timestamp: 'nope' }),
    ])
    .expect(201);
  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 4);
  assert.deepEqual(res.body.errors.map((e) => e.index), [1, 2, 3, 4]);
});

test('POST /api/events ignores unknown fields (no operator injection)', async () => {
  await request(app)
    .post('/api/events')
    .send(ev({ session_id: SID_A, event_type: 'page_view', $where: 'evil', admin: true }))
    .expect(201);
  const doc = await Event.findOne().lean();
  assert.equal(doc.admin, undefined);
  assert.equal(doc.$where, undefined);
});

test('GET /api/sessions lists sessions with counts, newest first', async () => {
  const t0 = Date.now();
  await request(app)
    .post('/api/events')
    .send([
      ev({ session_id: SID_A, event_type: 'page_view', timestamp: new Date(t0 - 5000).toISOString() }),
      ev({ session_id: SID_A, event_type: 'click', x: 1, y: 1, timestamp: new Date(t0 - 4000).toISOString() }),
      ev({ session_id: SID_A, event_type: 'click', x: 2, y: 2, timestamp: new Date(t0 - 3000).toISOString() }),
      ev({ session_id: SID_B, event_type: 'page_view', timestamp: new Date(t0).toISOString() }),
    ])
    .expect(201);

  const res = await request(app).get('/api/sessions').expect(200);
  assert.equal(res.body.total, 2);
  const [first, second] = res.body.sessions;
  assert.equal(first.session_id, SID_B);
  assert.equal(first.total_events, 1);
  assert.equal(second.session_id, SID_A);
  assert.equal(second.total_events, 3);
  assert.equal(second.clicks, 2);
  assert.equal(second.page_views, 1);

  const paged = await request(app).get('/api/sessions?limit=1&skip=1').expect(200);
  assert.equal(paged.body.sessions.length, 1);
  assert.equal(paged.body.sessions[0].session_id, SID_A);
});

test('GET /api/sessions/:id/events returns the ordered journey', async () => {
  const t0 = Date.now();
  // Inserted out of order on purpose.
  await request(app)
    .post('/api/events')
    .send([
      ev({ session_id: SID_A, event_type: 'click', x: 1, y: 1, timestamp: new Date(t0 + 2000).toISOString() }),
      ev({ session_id: SID_A, event_type: 'page_view', timestamp: new Date(t0).toISOString() }),
      ev({ session_id: SID_B, event_type: 'page_view', timestamp: new Date(t0).toISOString() }),
    ])
    .expect(201);

  const res = await request(app).get(`/api/sessions/${SID_A}/events`).expect(200);
  assert.equal(res.body.count, 2);
  assert.deepEqual(res.body.events.map((e) => e.event_type), ['page_view', 'click']);

  await request(app).get('/api/sessions/does-not-exist/events').expect(404);
});

test('GET /api/heatmap returns clicks for a normalised page URL', async () => {
  await request(app)
    .post('/api/events')
    .send([
      ev({ session_id: SID_A, event_type: 'click', x: 10, y: 20, page_url: `${PAGE}?utm=1` }),
      ev({ session_id: SID_B, event_type: 'click', x: 30, y: 40, page_url: `${PAGE}/` }),
      ev({ session_id: SID_B, event_type: 'page_view' }),
      ev({ session_id: SID_B, event_type: 'click', x: 99, y: 99, page_url: 'http://shop.test/other' }),
    ])
    .expect(201);

  const res = await request(app).get('/api/heatmap').query({ page_url: PAGE }).expect(200);
  assert.equal(res.body.page_url, PAGE);
  assert.equal(res.body.count, 2);
  assert.deepEqual(res.body.clicks.map((c) => [c.x, c.y]).sort(), [[10, 20], [30, 40]]);

  await request(app).get('/api/heatmap').expect(400);

  const pages = await request(app).get('/api/pages').expect(200);
  const products = pages.body.pages.find((p) => p.page_url === PAGE);
  assert.equal(products.clicks, 2);
  assert.equal(products.page_views, 1);
});

test('serves tracker.js', async () => {
  const res = await request(app).get('/tracker.js').expect(200);
  assert.match(res.headers['content-type'], /javascript/);
});
