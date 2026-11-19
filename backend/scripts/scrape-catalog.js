#!/usr/bin/env node
/**
 * Scrape a slice ("shard") of the catalog across every retailer and write the
 * raw cards to a JSON file. Several shards run in parallel in GitHub Actions;
 * scripts/merge-catalog.js stitches their output into the site's prices.json.
 *
 *   node scripts/scrape-catalog.js --shard 0 --shards 5 --out out/shard-0.json
 *   node scripts/scrape-catalog.js --limit 3 --only noon,amazon      (local smoke test)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { SCRAPERS, RETAILERS } from '../src/scrapers/index.js';
import { closeBrowser } from '../src/lib/browser.js';
import { makeCard } from '../src/lib/normalize.js';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const shard = Number(arg('shard', 0));
const shards = Number(arg('shards', 1));
const limitN = Number(arg('limit', 0));
const out = arg('out', 'out/shard.json');
const catalogPath = arg('catalog', new URL('../../catalog/items.json', import.meta.url).pathname);
const only = (arg('only', '') || '').split(',').filter(Boolean);
const concurrency = Number(arg('concurrency', 4));
const taskTimeoutMs = 60_000;
// After this many consecutive failures with zero successes, assume the retailer
// is blocking this IP and stop wasting time on it for the rest of the shard.
const BLOCK_AFTER = 6;

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
let items = catalog.filter((_, i) => i % shards === shard);
if (limitN) items = items.slice(0, limitN);
const retailerIds = Object.keys(SCRAPERS).filter((id) => !only.length || only.includes(id));

console.log(`shard ${shard + 1}/${shards}: ${items.length} items x ${retailerIds.join(', ')}`);

const stats = Object.fromEntries(retailerIds.map((id) => [id, { ok: 0, no_results: 0, unavailable: 0, streak: 0, blocked: false }]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => (t = setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))),
  ]);
}

async function scrapeOne(item, id) {
  const st = stats[id];
  if (st.blocked) {
    return { ...makeCard(RETAILERS[id]), status: 'unavailable', message: 'Blocked from this network', error: 'skipped: retailer blocking' };
  }
  const constraints = { must: item.must, mustNot: item.mustNot, allowMulti: item.allowMulti, price: item.price };
  let card;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      card = await withTimeout(SCRAPERS[id](item.query, { constraints }), taskTimeoutMs);
    } catch (err) {
      card = { ...makeCard(RETAILERS[id]), status: 'unavailable', message: 'Unavailable right now', error: err.message };
    }
    if (card.status !== 'unavailable') break;
    if (attempt === 1) await sleep(id === 'amazon' ? 12000 + Math.random() * 6000 : 3000 + Math.random() * 2000);
  }
  st[card.status] += 1;
  if (card.status === 'unavailable') {
    st.streak += 1;
    if (st.streak >= BLOCK_AFTER && st.ok === 0) {
      st.blocked = true;
      console.warn(`!! ${id}: ${st.streak} failures in a row with no successes, skipping the rest of this shard`);
    }
  } else {
    st.streak = 0;
  }
  const p = card.product;
  console.log(
    `[${id.padEnd(9)}] ${item.id.padEnd(32)} ${card.status.padEnd(11)} ` +
      (p ? `AED ${String(p.price).padEnd(8)} ${p.name}` : card.error ? `(${String(card.error).split('\n')[0].slice(0, 110)})` : '')
  );
  return card;
}

const limit = pLimit(concurrency);
const results = await Promise.all(
  items.map(async (item) => {
    // interleave retailers per item so no single host is hammered back-to-back
    const cards = {};
    // generic items (eggs, sugar) are only compared at the supermarkets: marketplaces
    // return unrelated listings for them (egg holders, erasers...)
    const ids = retailerIds.filter((id) => !item.retailers || item.retailers.includes(id));
    await Promise.all(ids.map((id) => limit(async () => (cards[id] = await scrapeOne(item, id)))));
    return { id: item.id, cards };
  })
);

await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify({ shard, shards, finishedAt: new Date().toISOString(), items: results }));
console.log('\nsummary:');
for (const id of retailerIds) {
  const { ok, no_results, unavailable } = stats[id];
  console.log(`  ${id.padEnd(10)} ok=${ok} no_results=${no_results} unavailable=${unavailable}`);
}
await closeBrowser();
setTimeout(() => process.exit(0), 300);
