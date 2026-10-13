// Seeds ~30 days of realistic ShopVerse traffic.
// Standalone: `npm run seed` (uses MONGODB_URI; SESSIONS, DAYS, BASE_URL optional). Also used by dev-memory.js.
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { Event } from '../src/models/Event.js';
import { validateEvent } from '../src/validate.js';
import { generateSession, makeRng, HOUR_WEIGHTS } from './shoppers.js';

/** Random session start within the last `days`, weighted by hour, weekday and a mild growth trend. */
function startTime(rng, days, now) {
  for (;;) {
    const ageDays = rng.next() * days;
    const t = new Date(now - ageDays * 86400e3);
    const hour = t.getHours();
    const weekend = t.getDay() === 0 || t.getDay() === 6;
    const w = HOUR_WEIGHTS[hour] / 7 * (weekend ? 1.25 : 1) * (1 - (ageDays / days) * 0.35);
    if (rng.next() < w) return t;
  }
}

export function generateEvents({ baseUrl = 'http://localhost:4000', sessions = 2000, days = 30, seed = 42 } = {}) {
  const rng = makeRng(seed);
  const now = Date.now() - 6 * 60e3; // keep "live" (last 5 min) empty until real traffic arrives
  const docs = [];
  let rejected = 0;
  for (let i = 0; i < sessions; i++) {
    const s = generateSession(rng, { baseUrl, start: startTime(rng, days, now) });
    for (const raw of s.events) {
      if (raw.timestamp > now) continue;
      const { event, error } = validateEvent({ ...raw, timestamp: raw.timestamp.toISOString() }, s.user_agent, { checkSkew: false });
      if (error) rejected++;
      else docs.push(event);
    }
  }
  if (rejected) console.warn(`seed: ${rejected} generated events failed validation`);
  return docs;
}

export async function seed(opts) {
  const docs = generateEvents(opts);
  for (let i = 0; i < docs.length; i += 5000) await Event.insertMany(docs.slice(i, i + 5000), { ordered: false });
  return docs.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/analytics';
  await mongoose.connect(uri);
  const n = await seed({
    baseUrl: process.env.BASE_URL || 'http://localhost:4000',
    sessions: Number(process.env.SESSIONS) || 2000,
    days: Number(process.env.DAYS) || 30,
  });
  console.log(`Inserted ${n} events`);
  await mongoose.disconnect();
}
