import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export function createApp({ dashboardDir } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // The tracker runs on arbitrary sites, so ingest must accept any origin.
  // Credentials are never used (session id travels in the body), so this is safe.
  app.use(cors());

  app.use(express.json({ limit: '256kb' }));
  // navigator.sendBeacon sends text/plain to avoid a CORS preflight.
  app.use(express.text({ type: 'text/plain', limit: '256kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', routes);

  // tracker.js + demo site.
  app.use(express.static(PUBLIC_DIR, { maxAge: '5m' }));

  // Optionally serve the built dashboard from the same server (single deploy).
  if (dashboardDir) {
    app.use('/dashboard', express.static(dashboardDir));
    app.get('/dashboard/{*splat}', (_req, res) => res.sendFile(path.join(dashboardDir, 'index.html')));
  }

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload too large' });
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
