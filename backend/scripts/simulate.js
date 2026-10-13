// Sends live synthetic shopper traffic to a running API, in real time, so the dashboard's
// Live view has something to show. Events go through the public ingest endpoint.
//
//   npm run simulate                         # ~8 new sessions/minute against http://localhost:4000
//   npm run simulate -- --url https://host --rate 20 --duration 10
//
// --rate      new sessions per minute (default 8)
// --duration  minutes to run (default: until Ctrl+C)
// --speed     time compression for in-session delays (default 4 = 4x faster than real shoppers)
import { parseArgs } from 'node:util';
import { generateSession, makeRng } from './shoppers.js';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: process.env.API_URL || 'http://localhost:4000' },
    rate: { type: 'string', default: '8' },
    duration: { type: 'string' },
    speed: { type: 'string', default: '4' },
  },
});
const base = values.url.replace(/\/$/, '');
const rate = Math.max(0.1, Number(values.rate) || 8);
const speed = Math.max(1, Number(values.speed) || 4);
const endAt = values.duration ? Date.now() + Number(values.duration) * 60e3 : Infinity;
const rng = makeRng();
let sent = 0;
let failed = 0;
let active = 0;

async function post(events, ua) {
  try {
    const res = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    sent += events.length;
  } catch (err) {
    failed += events.length;
    if (failed <= events.length) console.error('send failed:', err.message);
  }
}

/** Replays one generated session in (compressed) real time, batching like the tracker does. */
async function runSession() {
  active++;
  const s = generateSession(rng, { baseUrl: base, start: new Date() });
  const t0 = s.events[0].timestamp.getTime();
  const wall0 = Date.now();
  let batch = [];
  for (const e of s.events) {
    const due = wall0 + (e.timestamp.getTime() - t0) / speed;
    const delay = due - Date.now();
    if (delay > 1500 && batch.length) {
      await post(batch, s.user_agent);
      batch = [];
    }
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    batch.push({ ...e, timestamp: new Date().toISOString() });
  }
  if (batch.length) await post(batch, s.user_agent);
  active--;
}

console.log(`Simulating ~${rate} sessions/min against ${base} (Ctrl+C to stop)`);
const status = setInterval(() => console.log(`active sessions: ${active}  events sent: ${sent}${failed ? `  failed: ${failed}` : ''}`), 10000);

(async function loop() {
  while (Date.now() < endAt) {
    runSession();
    // Poisson arrivals.
    await new Promise((r) => setTimeout(r, (-Math.log(1 - rng.next()) * 60e3) / rate));
  }
  while (active > 0) await new Promise((r) => setTimeout(r, 500));
  clearInterval(status);
  console.log(`Done. ${sent} events sent.`);
})();
