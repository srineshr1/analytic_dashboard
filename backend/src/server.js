import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { ensureDb } from './db.js';

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics';

export async function start(uri = MONGODB_URI) {
  process.env.MONGODB_URI = uri;
  await ensureDb();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`\n  Home:       http://localhost:${PORT}/`);
    console.log(`  Store:      http://localhost:${PORT}/store/`);
    console.log(`  Dashboard:  http://localhost:${PORT}/dashboard/\n`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}
