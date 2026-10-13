import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Event } from './models/Event.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics';

export async function start(uri = MONGODB_URI) {
  await mongoose.connect(uri);
  await Event.syncIndexes();
  console.log(`Connected to MongoDB`);

  const dashboardDir = path.resolve(__dirname, '..', '..', 'dashboard', 'dist');
  const app = createApp({ dashboardDir: fs.existsSync(dashboardDir) ? dashboardDir : undefined });

  const server = app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`Demo site:     http://localhost:${PORT}/demo/`);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}
