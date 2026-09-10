import { config } from '../config.js';

/**
 * Per-host politeness gate. Ensures at least `perHostMinGapMs` between successive
 * scrapes of the same retailer host, even across concurrent searches.
 */
const lastHitByHost = new Map();
const queueByHost = new Map();

export async function politeWait(host) {
  const prev = queueByHost.get(host) || Promise.resolve();
  let release;
  const next = new Promise((r) => (release = r));
  queueByHost.set(host, prev.then(() => next));

  await prev;
  const last = lastHitByHost.get(host) || 0;
  const wait = Math.max(0, last + config.perHostMinGapMs - Date.now());
  if (wait > 0) await sleep(wait);
  lastHitByHost.set(host, Date.now());

  return () => release();
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Small random jitter to avoid a perfectly regular request cadence. */
export function jitter(baseMs, spreadMs = 400) {
  return baseMs + Math.floor(Math.random() * spreadMs);
}
