#!/usr/bin/env node
/**
 * Merge shard output into the site's prices.json.
 *
 *   node scripts/merge-catalog.js --shards-dir out --previous <url|file> --out prices.json
 *
 * - Item metadata always comes from catalog/items.json (so catalog edits apply
 *   immediately), prices from the shards.
 * - If a retailer failed this run but had a good price in the previous
 *   prices.json that is under STALE_MAX_HOURS old, keep the old price and flag it
 *   `stale` so a temporary block doesn't blank the site.
 * - Prints a coverage table (also appended to the GitHub job summary).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { RETAILER_LIST } from '../src/scrapers/retailers.js';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const shardsDir = arg('shards-dir', 'out');
const previousSrc = arg('previous', '');
const outPath = arg('out', 'prices.json');
const catalogPath = arg('catalog', new URL('../../catalog/items.json', import.meta.url).pathname);
const STALE_MAX_HOURS = 72;

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));

async function loadPrevious() {
  if (!previousSrc) return null;
  try {
    if (/^https?:/.test(previousSrc)) {
      const res = await fetch(previousSrc, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }
    return JSON.parse(await fs.readFile(previousSrc, 'utf8'));
  } catch (err) {
    console.log(`no previous prices (${err.message}); starting fresh`);
    return null;
  }
}

const fresh = new Map();
try {
  for (const f of (await fs.readdir(shardsDir)).filter((f) => /^shard-.*\.json$/.test(f))) {
    const data = JSON.parse(await fs.readFile(path.join(shardsDir, f), 'utf8'));
    for (const it of data.items) fresh.set(it.id, it.cards);
    console.log(`loaded ${f}: ${data.items.length} items`);
  }
} catch (err) {
  console.log(`no shard files (${err.message})`);
}

const previous = await loadPrevious();
const prevById = new Map((previous?.items || []).map((i) => [i.id, i.cards || {}]));

const compact = (card) => ({
  status: card.status,
  ...(card.message && card.status !== 'ok' ? { message: card.message } : {}),
  ...(card.product
    ? {
        product: {
          name: card.product.name,
          price: card.product.price,
          url: card.product.url,
          image: card.product.image,
          unit: card.product.unit,
        },
      }
    : {}),
  fetchedAt: card.fetchedAt,
});

const now = Date.now();
const counts = Object.fromEntries(RETAILER_LIST.map((r) => [r.id, { ok: 0, no_results: 0, unavailable: 0, stale: 0 }]));

const items = catalog.map((it) => {
  const newCards = fresh.get(it.id) || {};
  const oldCards = prevById.get(it.id) || {};
  const cards = {};
  for (const r of RETAILER_LIST) {
    if (it.retailers && !it.retailers.includes(r.id)) continue; // not compared here
    if (r.scrapeInCatalog === false) {
      // link-only retailer (robots.txt forbids scraping it): never carry prices forward
      cards[r.id] = { status: 'unavailable', message: 'link_only', fetchedAt: null };
      counts[r.id].unavailable += 1;
      continue;
    }
    let card = newCards[r.id] ? compact(newCards[r.id]) : null;
    const old = oldCards[r.id];
    const oldAgeH = old?.fetchedAt ? (now - Date.parse(old.fetchedAt)) / 36e5 : Infinity;
    if ((!card || card.status === 'unavailable') && old?.status === 'ok' && oldAgeH < STALE_MAX_HOURS) {
      card = { ...old, stale: true };
    }
    if (!card) card = { status: 'unavailable', message: 'Not checked yet', fetchedAt: null };
    cards[r.id] = card;
    counts[r.id][card.status] += 1;
    if (card.stale) counts[r.id].stale += 1;
  }
  return { id: it.id, name: it.name, category: it.category, rank: it.rank, query: it.query, aliases: it.aliases || [], cards };
});

const out = {
  version: 1,
  generatedAt: new Date().toISOString(),
  retailers: RETAILER_LIST.map(({ id, name, color, homepage, searchTemplate }) => ({ id, name, color, homepage, searchTemplate })),
  items,
};
await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(out));

const lines = ['| retailer | ok | no match | unavailable | (stale kept) |', '|---|---:|---:|---:|---:|'];
for (const r of RETAILER_LIST) {
  const c = counts[r.id];
  lines.push(`| ${r.name} | ${c.ok} | ${c.no_results} | ${c.unavailable} | ${c.stale} |`);
}
const table = lines.join('\n');
console.log(`\nwrote ${outPath}: ${items.length} items\n\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `## Price coverage\n\n${table}\n\nGenerated ${out.generatedAt}\n`);
}
