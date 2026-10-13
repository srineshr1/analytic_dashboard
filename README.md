# ShopVerse Analytics

A full-stack user analytics app. A small tracking script records how shoppers move through **ShopVerse**, an Amazon-style demo store with 194 products. A dark analytics dashboard then shows funnels, user flows, click and scroll heatmaps, live activity and full session journeys.

```
backend/     Node.js + Express API, MongoDB (Mongoose), tracker.js, seed + traffic simulator
store/       ShopVerse store: React single-page app, product data from DummyJSON
dashboard/   Analytics dashboard: React + Recharts
```

## Quick start

Requires Node.js 20+. No MongoDB install is needed for the quick start.

```bash
npm run setup     # installs all three packages and builds the store + dashboard
npm run dev       # API on :4000 with an in-memory MongoDB, seeded with 30 days of traffic
```

Open **http://localhost:4000/**. It links to:

| URL | What |
| --- | --- |
| http://localhost:4000/store/ | ShopVerse store: browse, search, add to cart, check out |
| http://localhost:4000/dashboard/ | Analytics dashboard |

For live traffic in the dashboard's **Live** view, run this in a second terminal:

```bash
npm run simulate                      # ~8 synthetic shoppers per minute
npm run simulate -- --rate 30         # busier
```

Your own clicks in the store show up too. The session id is stored in `localStorage` under `ua_session`.

### Using a real MongoDB

```bash
docker compose up -d                                    # or MongoDB Atlas / your own server
MONGODB_URI=mongodb://127.0.0.1:27017/analytics npm start
MONGODB_URI=mongodb://127.0.0.1:27017/analytics npm run seed   # optional sample data
```

### Developing the front ends

`npm run dev` in `store/` (port 5174) or `dashboard/` (port 5173) starts Vite with hot reload. Both proxy `/api` and `/tracker.js` to the API on :4000.

### Tests

```bash
npm test          # backend: ingest validation + every analytics endpoint (node:test, supertest, mongodb-memory-server)
```

## Tech stack

- **Tracker**: dependency-free vanilla JS, `backend/public/tracker.js`
- **Backend**: Node.js, Express 5, Mongoose 9, MongoDB
- **Store**: React 19, React Router 7, Vite 8. Product data and images from [DummyJSON](https://dummyjson.com)
- **Dashboard**: React 19, React Router 7, Recharts 3, lucide-react icons, plain CSS
- **Tests**: `node:test`, supertest, mongodb-memory-server

## What gets tracked

The tracker records these automatically:

| Event | When |
| --- | --- |
| `page_view` | Page load, and every in-app navigation (`pushState`/`popstate`) |
| `click` | Every click: document x/y, element selector, and a readable name from `data-track="add-to-cart"` (falls back to aria-label or text) |
| `rage_click` | 3+ clicks within 700 ms in a 40 px radius |
| `scroll_depth` | First time the visitor reaches 25 / 50 / 75 / 100 % of the page |
| `time_on_page` | Visible time on a page, sent when leaving it (hidden tabs don't count) |

The store sends these business events through `Tracker.track(type, props)`:

| Event | Props |
| --- | --- |
| `product_view` | `product_id, product_name, category, brand, price` |
| `search` | `query, results` |
| `add_to_cart` / `remove_from_cart` | `product_id, product_name, category, price, quantity` |
| `begin_checkout` | `value, items_count` |
| `purchase` | `order_id, value, items_count, items[]` |

Every event carries `session_id`, `event_type`, `page_url`, `timestamp`, viewport and page size. Clicks also carry `x`/`y`.

### Adding the tracker to any site

```html
<script src="https://YOUR_API_HOST/tracker.js" defer
        data-page-groups="/product/:id,/category/:slug"></script>
```

- `data-page-groups`: path patterns. Every product page then shares one heatmap and one node in the flow diagram (`/store/product/:id`) instead of 194 separate ones.
- `data-endpoint`: optional ingest URL.
- `data-debug`: logs events to the console.

## Dashboard

| Page | Shows |
| --- | --- |
| Overview | KPIs with change vs. the previous period (sessions, page views, conversion, revenue, AOV, bounce rate, session length, rage clicks), traffic and revenue charts, devices, funnel summary, top pages, elements and searches |
| Live | Active sessions (last 5 min), events per minute, an auto-refreshing event stream |
| Funnel | Visit → product → cart → checkout → purchase, with drop-off and cart abandonment |
| User flow | Sankey diagram of page-to-page navigation, plus a top-transitions table |
| Pages | Views, time on page, scroll depth, clicks, rage clicks, entries/exits per page |
| Clicks | Most clicked elements, clicks by page, rage-click hotspots |
| Heatmap | Click or rage-click positions as dots, heat or grid over a live preview of the page, with scroll-depth bands |
| Sessions → Journey | Searchable session list. Each session is a timeline grouped by page visit |
| Products / Search | View→cart→purchase per product and category, top and zero-result searches |

Date range (24h / 7d / 30d / 90d / all) and device filter apply globally and are kept in the URL.

## API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/events` | Ingest one event, an array, or `{ events: [...] }` (JSON or `text/plain` for `sendBeacon`). Max 100 per request |
| GET | `/api/sessions` | Sessions with event counts, newest first. `limit, skip, range, device, q` (id prefix), `converted=1` |
| GET | `/api/sessions/:id/events` | All events of a session in order (the user journey) |
| GET | `/api/pages` | Tracked pages with click/view counts and a sample URL |
| GET | `/api/heatmap` | Click positions for a page: `page_url` (page key), `type=click\|rage_click`, `device`, `range` |
| GET | `/api/live` | Recent events, active sessions, events per minute |
| GET | `/api/stats/{overview,timeseries,funnel,flows,pages,clicks,search,products,devices,scroll}` | Aggregated analytics. All accept `range` (`1h,24h,7d,30d,90d,all` or `from/to`) and `device` |

The first four rows are the APIs the assignment asks for.

Event document (MongoDB `events` collection):

```json
{
  "session_id": "6f1c…", "event_type": "click",
  "page_url": "http://localhost:4000/store/product/121", "page_group": "/store/product/:id",
  "page_key": "http://localhost:4000/store/product/:id",
  "timestamp": "2026-10-13T10:00:00.000Z",
  "x": 812, "y": 431, "target": "button.btn.btn-yellow", "target_label": "add-to-cart",
  "viewport_width": 1280, "viewport_height": 800, "page_width": 1266, "page_height": 2805, "device": "desktop",
  "props": { "product_id": "121", "price": 899.99 }
}
```

Indexes:
- `{session_id, timestamp}`: journeys and session aggregation
- `{page_key, event_type}`: heatmaps
- `{timestamp, event_type}`: date-range analytics

## Sample data

`npm run dev` and `npm run seed` generate about 2,000 sessions over 30 days (`backend/scripts/shoppers.js`).
- **Shopper types**: bouncers, browsers, searchers, cart abandoners and buyers.
- **Time patterns**: traffic follows a daily cycle and a mild growth trend.
- **Devices**: desktop, mobile and tablet, with real user agents.
- **Searches**: a mix of real and zero-result queries.
- **Purchases**: realistic order values.

Synthetic clicks land inside real element boxes. These boxes were measured from the built store with Playwright at desktop, tablet and mobile widths and saved in `backend/scripts/store-layouts.json`, so seeded heatmaps line up with the page underneath. If you change the store layout a lot, re-capture the boxes. Your own tracked clicks are always exact.

## Assumptions and trade-offs

- **Sessions**: a UUID in `localStorage` (cookie fallback). A new session starts after 30 minutes of inactivity. There's no user identity and no cross-device linking, and no login anywhere, by design.
- **Delivery**: events are batched (every 2 s or 20 events) and flushed with `sendBeacon` when a page is hidden or closed. Payloads are `text/plain`, so cross-origin sites don't trigger a CORS preflight. If the beacon fails, a few events can be lost.
- **Heatmap coordinates**: clicks are stored as document coordinates plus the viewport and page size. The heatmap scales x by page width to a reference width per device class and keeps y in pixels. Layouts change between breakpoints, so each heatmap shows one device class (desktop by default).
- **Page grouping**: URLs are grouped by `data-page-groups` patterns, otherwise by origin + path. Query strings and trailing slashes never split a page.
- **Page preview**: the heatmap shows the page in an iframe with `?ua_preview=1`, and the tracker ignores those loads. Sites that forbid framing still show the dots, just without the page behind them.
- **Funnel**: a session counts for a step only if it reached every earlier step, in any order within the session.
- **Aggregation**: everything is computed on read with MongoDB aggregation pipelines. That's fast enough for tens of thousands of events (endpoints answer in roughly 50 to 110 ms on the 57k-event sample). At real scale I'd pre-aggregate sessions and daily rollups on ingest, or use a columnar store.
- **Store**: client-side only. The cart and orders live in `localStorage`, and checkout is simulated (no payments). Dashboard revenue is the order subtotal, before shipping and tax. Product images load from DummyJSON's CDN.
- **Security**: ingest is public by design and validates strictly (whitelisted fields and props, per-type rules, size limits, http(s) URLs only). **The read APIs and the dashboard have no authentication**, as requested. Add an API key or login and rate limiting before deploying this publicly.
