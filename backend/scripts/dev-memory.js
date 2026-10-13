// Runs the API against an in-memory MongoDB (no local install needed).
// Data is lost on exit. Seeds 30 days of sample traffic unless SEED=0 (SESSIONS=n to change volume).
import { MongoMemoryServer } from 'mongodb-memory-server';
import { start } from '../src/server.js';
import { seed } from './seed.js';

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri('analytics');
console.log('In-memory MongoDB at', uri);

await start(uri);
if (process.env.SEED !== '0') {
  const t = Date.now();
  const n = await seed({ baseUrl: `http://localhost:${process.env.PORT || 4000}`, sessions: Number(process.env.SESSIONS) || 2000 });
  console.log(`Seeded ${n} sample events in ${((Date.now() - t) / 1000).toFixed(1)}s. For live traffic run: npm run simulate`);
}

process.on('exit', () => mongod.stop());
