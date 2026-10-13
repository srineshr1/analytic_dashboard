// Runs the API against an in-memory MongoDB (no local install needed).
// Data is lost on exit. Seeds sample data unless SEED=0.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { start } from '../src/server.js';
import { seed } from './seed.js';

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri('analytics');
console.log('In-memory MongoDB at', uri);

await start(uri);
if (process.env.SEED !== '0') {
  const n = await seed({ baseUrl: `http://localhost:${process.env.PORT || 4000}` });
  console.log(`Seeded ${n} sample events`);
}

process.on('exit', () => mongod.stop());
