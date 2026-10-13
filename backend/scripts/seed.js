// Generates realistic sample sessions for the demo site.
// Standalone: `npm run seed` (uses MONGODB_URI). Also imported by dev-memory.js.
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Event } from '../src/models/Event.js';
import { normalizePageUrl } from '../src/validate.js';

// Hotspots measured on the demo pages at ~1280px viewport (x as % of width, y in px).
const PAGES = {
  '/demo/': [
    [0.14, 282], [0.14, 282], [0.113, 585], [0.342, 585], [0.569, 585], [0.85, 31], [0.922, 31],
  ],
  '/demo/products.html': [
    [0.112, 449], [0.341, 449], [0.341, 449], [0.57, 449], [0.799, 449], [0.112, 773], [0.341, 773], [0.111, 858],
  ],
  '/demo/checkout.html': [
    [0.23, 265], [0.23, 344], [0.23, 423], [0.113, 478], [0.113, 478],
  ],
};
const FLOWS = [
  ['/demo/', '/demo/products.html', '/demo/checkout.html'],
  ['/demo/', '/demo/products.html'],
  ['/demo/products.html', '/demo/checkout.html'],
  ['/demo/'],
  ['/demo/', '/demo/products.html', '/demo/', '/demo/products.html', '/demo/checkout.html'],
];
// Desktop-only so the seeded hotspots line up with the real layout.
const VIEWPORTS = [[1280, 800], [1280, 720], [1300, 900]];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const jitter = (v, amt) => v + (Math.random() - 0.5) * 2 * amt;

export function generateEvents({ baseUrl = 'http://localhost:4000', sessions = 25 } = {}) {
  const events = [];
  const now = Date.now();

  for (let s = 0; s < sessions; s++) {
    const session_id = randomUUID();
    const [vw, vh] = pick(VIEWPORTS);
    let t = now - rand(0, 3 * 24 * 3600 * 1000);

    for (const path of pick(FLOWS)) {
      const page_url = `${baseUrl}${path}`;
      const page_height = Math.max(vh, path === '/demo/products.html' ? 997 : 800);
      const common = {
        session_id, page_url, page_key: normalizePageUrl(page_url),
        viewport_width: vw, viewport_height: vh, page_width: vw, page_height,
      };
      events.push({ ...common, event_type: 'page_view', timestamp: new Date(t) });

      const clicks = Math.floor(rand(1, 6));
      for (let c = 0; c < clicks; c++) {
        t += rand(1500, 15000);
        const [px, py] = pick(PAGES[path]);
        events.push({
          ...common,
          event_type: 'click',
          timestamp: new Date(t),
          x: Math.max(0, Math.round(jitter(px * vw, 30))),
          y: Math.max(0, Math.round(jitter(py, 20))),
        });
      }
      t += rand(3000, 30000);
    }
  }
  return events;
}

export async function seed(opts) {
  const events = generateEvents(opts);
  await Event.insertMany(events);
  return events.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics';
  await mongoose.connect(uri);
  const n = await seed({ baseUrl: process.env.BASE_URL || 'http://localhost:4000' });
  console.log(`Inserted ${n} events`);
  await mongoose.disconnect();
}
