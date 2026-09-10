import pLimit from 'p-limit';
import { config } from './config.js';
import { cache } from './lib/cache.js';
import { createLogger } from './lib/logger.js';
import { SCRAPERS, RETAILERS } from './scrapers/index.js';
import { makeCard } from './lib/normalize.js';

const log = createLogger('search');
const limit = pLimit(config.scraperConcurrency);

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

/**
 * Run every retailer scraper for `query`, each isolated so one failure never
 * breaks the others. Individually cached per retailer so a retry only re-scrapes
 * the ones that were stale or failed.
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {string[]} [opts.only]   restrict to these retailer ids (used by tests)
 * @param {boolean} [opts.fresh]   bypass cache
 * @returns {Promise<{ query: string, results: object[], cheapest: string|null }>}
 */
export async function search(query, opts = {}) {
  const normQuery = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const ids = (opts.only && opts.only.length ? opts.only : Object.keys(SCRAPERS)).filter(
    (id) => SCRAPERS[id]
  );

  const tasks = ids.map((id) =>
    limit(async () => {
      const retailer = RETAILERS[id];
      const cacheKey = `card:${id}:${normQuery}`;

      if (!opts.fresh) {
        const cached = cache.get(cacheKey);
        if (cached) {
          log.debug(`cache hit ${id} "${normQuery}"`);
          return { ...cached, cached: true };
        }
      }

      const started = Date.now();
      const card = await withTimeout(
        Promise.resolve()
          .then(() => SCRAPERS[id](normQuery, {}))
          .catch((err) => {
            log.error(`${id} threw: ${err.stack || err.message}`);
            return {
              ...makeCard(retailer),
              status: 'unavailable',
              message: 'Unavailable right now',
              error: err.message,
            };
          }),
        config.scraperTimeoutMs + 3000,
        () => {
          log.warn(`${id} timed out after ${config.scraperTimeoutMs + 3000}ms`);
          return {
            ...makeCard(retailer),
            status: 'unavailable',
            message: 'Timed out',
            error: 'timeout',
          };
        }
      );

      card.tookMs = Date.now() - started;
      const ttl = card.status === 'ok' ? config.cacheTtlMs : config.cacheErrorTtlMs;
      cache.set(cacheKey, card, ttl);
      log.info(`${id} "${normQuery}" -> ${card.status} (${card.tookMs}ms)`);
      return card;
    })
  );

  const results = await Promise.all(tasks);
  results.sort((a, b) => {
    // ok cards first, then by price, then by retailer order.
    const rank = (c) => (c.status === 'ok' ? 0 : c.status === 'no_results' ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.status === 'ok' && b.status === 'ok') {
      return (a.product?.price ?? Infinity) - (b.product?.price ?? Infinity);
    }
    return RETAILERS[a.retailer].order - RETAILERS[b.retailer].order;
  });

  const priced = results.filter((c) => c.status === 'ok' && c.product?.price != null);
  const cheapest =
    priced.length > 0
      ? priced.reduce((min, c) => (c.product.price < min.product.price ? c : min)).retailer
      : null;

  return { query: normQuery, results, cheapest, generatedAt: new Date().toISOString() };
}
