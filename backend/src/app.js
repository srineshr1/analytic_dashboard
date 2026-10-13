import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export const DEFAULT_SPA_DIRS = {
  store: path.join(ROOT, 'store', 'dist'),
  dashboard: path.join(ROOT, 'dashboard', 'dist'),
};

/** Serve a built single-page app under /<mount>, falling back to index.html for client routes. */
function mountSpa(app, mount, dir) {
  const index = path.join(dir, 'index.html');
  app.use(`/${mount}`, express.static(dir, { index: false, maxAge: '1h' }));
  app.get([`/${mount}`, `/${mount}/{*splat}`], (_req, res) => {
    if (fs.existsSync(index)) return res.sendFile(index);
    res
      .status(503)
      .type('text/plain')
      .send(`The ${mount} hasn't been built yet. Run "npm run build" (repo root) or "cd ${mount} && npm run build".`);
  });
}

export function createApp({ spaDirs = DEFAULT_SPA_DIRS } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // The tracker runs on arbitrary sites, so ingest must accept any origin.
  // Credentials are never used (session id travels in the body), so this is safe.
  // Read APIs stay same-origin (the dashboard is served from this server). Set
  // DASHBOARD_ORIGIN to allow a separately hosted dashboard.
  app.use('/api/events', cors());
  if (process.env.DASHBOARD_ORIGIN) app.use('/api', cors({ origin: process.env.DASHBOARD_ORIGIN.split(',') }));

  app.use(express.json({ limit: '256kb' }));
  // navigator.sendBeacon sends text/plain to avoid a CORS preflight.
  app.use(express.text({ type: 'text/plain', limit: '256kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', routes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

  // tracker.js + landing page.
  app.use(express.static(PUBLIC_DIR, { maxAge: '5m' }));

  if (spaDirs.store) mountSpa(app, 'store', spaDirs.store);
  if (spaDirs.dashboard) mountSpa(app, 'dashboard', spaDirs.dashboard);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload too large' });
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
