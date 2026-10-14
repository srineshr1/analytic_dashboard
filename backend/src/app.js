import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';
import { ensureDb } from './db.js';
import { spaFiles } from './spa-files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function firstExisting(candidates, marker) {
  for (const dir of candidates) {
    if (fs.existsSync(marker ? path.join(dir, marker) : dir)) return dir;
  }
  return candidates[0];
}

const PUBLIC_DIR = firstExisting(
  [path.join(__dirname, '..', 'public'), path.join(process.cwd(), 'backend', 'public'), path.join('/var/task', 'backend', 'public')],
  'index.html',
);

function spaDir(name) {
  return firstExisting(
    [path.join(ROOT, name, 'dist'), path.join(process.cwd(), name, 'dist'), path.join('/var/task', name, 'dist')],
    'index.html',
  );
}

export const DEFAULT_SPA_DIRS = {
  store: spaDir('store'),
  dashboard: spaDir('dashboard'),
};

const SPA_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function spaRelative(mount, requestPath) {
  const prefix = `/${mount}`;
  const rest = requestPath === prefix || requestPath.startsWith(`${prefix}/`) ? requestPath.slice(prefix.length) : requestPath;
  const rel = rest.replace(/^\/+/, '');
  return rel === '' ? 'index.html' : rel;
}

function sendSpaFile(res, rel, body) {
  const ext = path.extname(rel).toLowerCase();
  res.setHeader('Content-Type', SPA_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'public, max-age=60' : 'public, max-age=3600');
  res.send(body);
}

/**
 * Serve a built single-page app under /<mount>.
 * A directory on disk is used when one exists (local npm start). On Vercel the
 * Vite output is imported from spa-files.js, because the function bundle does
 * not keep store/dist or dashboard/dist.
 */
function mountSpa(app, mount, dir, files) {
  const index = path.join(dir, 'index.html');
  const onDisk = fs.existsSync(index);
  if (onDisk) app.use(`/${mount}`, express.static(dir, { index: false, maxAge: '1h' }));

  app.get([`/${mount}`, `/${mount}/{*splat}`], (req, res) => {
    const rel = spaRelative(mount, req.path);
    if (onDisk) {
      if (rel === 'index.html' || !path.extname(rel)) return res.sendFile(index);
      return res.status(404).type('text/plain').send('Not found');
    }

    const bundled = files[`${mount}/${rel}`];
    if (bundled != null) return sendSpaFile(res, rel, bundled);
    if (files[`${mount}/index.html`] != null) {
      if (!path.extname(rel)) return sendSpaFile(res, 'index.html', files[`${mount}/index.html`]);
      return res.status(404).type('text/plain').send('Not found');
    }
    res
      .status(503)
      .type('text/plain')
      .send(`The ${mount} hasn't been built yet. Run "npm run build" (repo root) or "cd ${mount} && npm run build".`);
  });
}

export function createApp({ spaDirs = DEFAULT_SPA_DIRS, files = spaFiles } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    ensureDb().then(() => next(), next);
  });

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

  if (spaDirs.store) mountSpa(app, 'store', spaDirs.store, files);
  if (spaDirs.dashboard) mountSpa(app, 'dashboard', spaDirs.dashboard, files);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload too large' });
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
