#!/usr/bin/env node
/**
 * Manual scraper harness. Runs one (or all) scrapers against a live query and
 * prints the resulting cards. Use this to verify a scraper before wiring it in.
 *
 *   node scripts/test-scraper.js lulu "olive oil"
 *   node scripts/test-scraper.js all bread
 */
import { SCRAPERS } from '../src/scrapers/index.js';
import { search } from '../src/search.js';
import { closeBrowser } from '../src/lib/browser.js';

const target = (process.argv[2] || 'all').toLowerCase();
const query = process.argv.slice(3).join(' ') || 'milk';

const run = async () => {
  if (target === 'all') {
    const payload = await search(query, { fresh: true });
    console.dir(payload, { depth: 6 });
    return;
  }
  const fn = SCRAPERS[target];
  if (!fn) {
    console.error(`Unknown scraper "${target}". Options: ${Object.keys(SCRAPERS).join(', ')}, all`);
    process.exit(1);
  }
  const started = Date.now();
  const card = await fn(query, {});
  console.dir({ ...card, _elapsedMs: Date.now() - started }, { depth: 6 });
};

run()
  .catch((err) => {
    console.error('harness error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    // give playwright a beat to release handles
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  });
