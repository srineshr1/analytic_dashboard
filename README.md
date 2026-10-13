# User Analytics Application

A small full-stack app that tracks `page_view` and `click` events on a website and shows them in a dashboard (session journeys + click heatmap).

```
backend/     Node.js + Express API, MongoDB (Mongoose), tracker.js, demo site
dashboard/   React (Vite) dashboard
```

## Tech stack

- **Tracker**: dependency-free vanilla JS (`backend/public/tracker.js`, ~4 KB)
- **Backend**: Node.js, Express 5, Mongoose 9
- **Database**: MongoDB
- **Dashboard**: React 19 + Vite
- **Tests**: `node:test`, supertest, mongodb-memory-server

## Setup

Requires Node.js 20+.

```bash
# 1. Install
cd backend && npm install
cd ../dashboard && npm install
```

### Option A: no MongoDB install (quickest)

```bash
cd backend
npm run dev:memory     # API on :4000 with an in-memory MongoDB, seeded with sample data
```

### Option B: real MongoDB

```bash
docker compose up -d                 # or use your own MongoDB / Atlas
cd backend
MONGODB_URI=mongodb://127.0.0.1:27017/analytics npm start
npm run seed                         # optional sample data
```

### Dashboard

```bash
cd dashboard
npm run dev            # http://localhost:5173 (proxies /api and /demo to :4000)
```

Or build it once (`npm run build`) and the API serves it at `http://localhost:4000/dashboard/`.

### Try it

1. Open the demo store at `http://localhost:4000/demo/` and click around. The badge in the bottom-right corner shows your session id.
2. Open the dashboard. Your session shows up under **Sessions**; click it to see the journey.
3. In **Heatmap**, pick a page to see where people clicked.

### Tests

```bash
cd backend && npm test
```

## Adding the tracker to any site

```html
<script src="https://YOUR_API_HOST/tracker.js" defer></script>
<!-- optional: data-endpoint="https://.../api/events"  data-debug -->
```

`window.Tracker` exposes `getSessionId()`, `track(type, extra)` and `flush()`.

## API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/events` | Ingest one event, an array, or `{ events: [...] }` (JSON or `text/plain`) |
| GET | `/api/sessions?limit=&skip=` | Sessions with total/page-view/click counts, newest first |
| GET | `/api/sessions/:id/events` | All events of a session, chronological (user journey) |
| GET | `/api/pages` | Tracked pages with click/view counts |
| GET | `/api/heatmap?page_url=` | Click coordinates for a page |

Event document:

```json
{
  "session_id": "uuid", "event_type": "click",
  "page_url": "https://shop.test/products?utm=x", "page_key": "https://shop.test/products",
  "timestamp": "2026-10-13T10:00:00.000Z",
  "x": 431, "y": 449, "target": "button.btn.add",
  "viewport_width": 1280, "viewport_height": 800, "page_width": 1280, "page_height": 997
}
```

Indexes: `{session_id, timestamp}` for journeys and session aggregation, `{page_key, event_type}` for heatmaps.

## Assumptions and trade-offs

- **Sessions**: a UUID kept in `localStorage` (cookie fallback). A new session starts after 30 minutes of inactivity. There is no cross-device identity.
- **Delivery**: events are batched (every 2 s or 20 events) and flushed with `sendBeacon` when the page is hidden or unloaded. The payload is sent as `text/plain` so cross-origin requests don't need a CORS preflight. If the beacon fails, a few events can be lost.
- **Heatmap coordinates**: clicks are stored as document coordinates (`pageX/pageY`) along with the viewport and page size. The heatmap scales x by page width and keeps y in pixels, and you can filter by device class (desktop/tablet/mobile). This is accurate for fluid layouts. For layouts whose structure changes between breakpoints, use the device filter.
- **URL grouping**: heatmaps group by origin + path, so query strings, hashes and trailing slashes don't split the data. `/demo/` and `/demo/index.html` count as different pages.
- **Page preview**: the heatmap loads the page in a sandboxed iframe with `?ua_preview=1`, and the tracker ignores those loads. Sites that send `X-Frame-Options`/CSP `frame-ancestors` won't render underneath, but the dots still show.
- **Session aggregation** is computed on read with an aggregation pipeline. That's fine at this scale. At high volume I'd keep a pre-aggregated `sessions` collection updated on ingest.
- **Security**: the ingest endpoint is public by design (any site can send to it) and validates input strictly (whitelisted fields, size limits, max 100 events per batch). **The read APIs and dashboard have no authentication.** Add auth (an API key or login) and rate limiting before exposing this publicly.
