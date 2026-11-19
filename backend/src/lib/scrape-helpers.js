import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { createLogger } from './logger.js';
import { newContext } from './browser.js';
import { isAllowed } from './robots.js';
import { politeWait, sleep, jitter } from './throttle.js';
import { makeCard } from './normalize.js';

/**
 * Wraps the common lifecycle of a browser-based scraper:
 *  - robots.txt check
 *  - per-host polite delay
 *  - fresh browser context (auto-closed)
 *  - uniform error -> 'unavailable' card mapping
 *  - optional debug artifact dump on failure
 *
 * @param {object} retailer  entry from RETAILERS
 * @param {string} query
 * @param {(args: { page, context, log }) => Promise<object>} run
 *        should return a partial card patch, e.g. { status:'ok', product } or
 *        { status:'no_results' }.
 * @param {object} [opts]
 * @param {string} [opts.checkUrl]  URL used for the robots.txt check
 * @param {boolean} [opts.loadImages]
 */
export async function runBrowserScraper(retailer, query, run, opts = {}) {
  const log = createLogger(`scraper:${retailer.id}`);
  const card = makeCard(retailer);

  const checkUrl = opts.checkUrl || retailer.homepage;
  try {
    if (!(await isAllowed(checkUrl))) {
      log.warn(`robots.txt disallows ${checkUrl}`);
      return { ...card, status: 'unavailable', message: 'Blocked by robots.txt' };
    }
  } catch (err) {
    log.warn(`robots check failed, proceeding: ${err.message}`);
  }

  const release = await politeWait(retailer.host);
  let context;
  try {
    await sleep(jitter(150, 500));
    context = await newContext({ loadImages: opts.loadImages, noRoutes: opts.noRoutes });
    const page = await context.newPage();
    page.setDefaultTimeout(config.scraperTimeoutMs);
    page.setDefaultNavigationTimeout(config.scraperTimeoutMs);

    const patch = await run({ page, context, log });
    const merged = { ...card, ...patch, fetchedAt: new Date().toISOString() };

    if (merged.status === 'ok' && (!merged.product || merged.product.price == null)) {
      log.warn('scraper returned ok without a usable price; downgrading to no_results');
      merged.status = 'no_results';
      merged.product = merged.product || null;
    }
    return merged;
  } catch (err) {
    log.error(`failed: ${err.message}`);
    if (config.debugArtifacts && context) {
      await dumpDebug(retailer.id, query, context).catch(() => {});
    }
    return {
      ...card,
      status: 'unavailable',
      message: opts.unavailableMessage || 'Unavailable right now',
      error: err.message,
    };
  } finally {
    release();
    if (context) await context.close().catch(() => {});
  }
}

async function dumpDebug(retailerId, query, context) {
  const dir = path.resolve('scraper-debug');
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = query.replace(/[^a-z0-9]+/gi, '_').slice(0, 30);
  const pages = context.pages();
  if (!pages.length) return;
  const page = pages[0];
  const base = path.join(dir, `${retailerId}_${slug}_${stamp}`);
  await page.screenshot({ path: `${base}.png`, fullPage: false }).catch(() => {});
  const html = await page.content().catch(() => '');
  await fs.writeFile(`${base}.html`, html);
}

/**
 * Pick the "best" product from a list of candidates for a query: prefer ones
 * whose name contains all query tokens, then lowest price.
 */
export function pickBestMatch(query, candidates, constraints) {
  let usable = candidates.filter((c) => c && c.price != null && c.name);
  if (!usable.length) return null;

  // Catalog mode: the caller knows exactly which product it wants (brand, size,
  // exclusions), so filter to candidates that satisfy that spec and take the
  // cheapest of the most relevant few. This keeps prices comparable across
  // retailers instead of guessing from a loose query.
  if (constraints && (constraints.must?.length || constraints.mustNot?.length || constraints.price)) {
    const [lo, hi] = constraints.price || [0, Infinity];
    const valid = usable.filter((c) => c.price >= lo && c.price <= hi && matchesConstraints(c.name, constraints));
    if (!valid.length) return null;
    return valid.slice(0, 10).reduce((a, b) => (b.price < a.price ? b : a));
  }
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  // match a token if the name contains it, its singular form, or vice versa
  const tokenInName = (token, name) => {
    if (name.includes(token)) return true;
    const stem = token.replace(/(ies|es|s)$/, (m) => (m === 'ies' ? 'y' : ''));
    return stem.length > 2 && name.includes(stem);
  };

  const phrase = tokens.join(' ');
  const scored = usable.map((c, i) => {
    const name = c.name.toLowerCase();
    const matched = tokens.filter((t) => tokenInName(t, name)).length;
    // tier: 2 = name contains the whole query phrase, 1 = all tokens present,
    // 0 = partial. Within a tier we go cheapest, using source order as tiebreak.
    let tier = 0;
    if (tokens.length && matched === tokens.length) tier = phrase && name.includes(phrase) ? 2 : 1;
    return { c, matched, tier, order: i };
  });

  const maxMatched = Math.max(...scored.map((s) => s.matched));
  // Nothing matched at all -> the retailer only returned unrelated items.
  if (tokens.length > 0 && maxMatched === 0) return null;

  const bestTier = Math.max(...scored.map((s) => s.tier));
  const pool = (bestTier > 0 ? scored.filter((s) => s.tier === bestTier) : scored.filter((s) => s.matched === maxMatched));
  pool.sort((a, b) => a.c.price - b.c.price || a.order - b.order);
  return pool[0].c;
}

/**
 * Canonicalise a product name so sizes compare reliably across retailers:
 * "1 Litre", "1 LTR", "1L" -> "1l"; "500 ml" -> "500ml"; "1 kg" -> "1kg"; etc.
 */
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*(?:litres?|liters?|ltrs?|ltr|l)\b/g, '$1l')
    .replace(/(\d+(?:\.\d+)?)\s*(?:millilitres?|milliliters?|mls?)\b/g, '$1ml')
    .replace(/(\d+(?:\.\d+)?)\s*(?:kilograms?|kilos?|kgs?)\b/g, '$1kg')
    .replace(/(\d+(?:\.\d+)?)\s*(?:grams?|gms?|gm|g)\b/g, '$1g')
    .replace(/(\d+)\s*(?:pcs|pieces?|pack|count|ct)\b/g, '$1pcs')
    .replace(/[^a-z0-9.+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SIZE_TOKEN = /^\d+(?:\.\d+)?(?:l|ml|kg|g|pcs)$/;

/**
 * `must`: every entry has to appear in the name; an entry may offer
 * alternatives separated by "|" (any one is enough). Size tokens ("1l", "500g")
 * only match as a whole number so "1l" never matches inside "11l" or "21l".
 * `mustNot`: none of these may appear.
 */
const MULTIPACK = /\b\d+ x \d|\bpack of \d|\bbundle\b|\bvalue pack\b|\bcarton of\b/;

export function matchesConstraints(name, { must = [], mustNot = [], allowMulti = false } = {}) {
  const n = ` ${normalizeName(name)} `;
  // multi-packs ("2 x 1L", "pack of 6") are different products; skip them
  // unless the catalog item is explicitly a multi-pack.
  if (!allowMulti && MULTIPACK.test(n)) return false;
  const has = (tok) => {
    const t = normalizeName(tok);
    if (!t) return false;
    if (SIZE_TOKEN.test(t)) return new RegExp(`(?:^|[^0-9.])${t.replace('.', '\\.')}(?![a-z0-9])`).test(n);
    return n.includes(` ${t} `) || n.includes(` ${t}`) ;
  };
  for (const m of must) {
    if (!String(m).split('|').some((alt) => has(alt))) return false;
  }
  for (const m of mustNot) {
    if (String(m).split('|').some((alt) => has(alt))) return false;
  }
  return true;
}

/**
 * Throw if the page is a bot-wall interstitial (Cloudflare "Attention Required" /
 * "Just a moment", Akamai "Access Denied", generic "you have been blocked").
 * Without this a blocked page parses as "0 products" and is wrongly reported as
 * "not found" instead of "couldn't be checked".
 */
export async function assertNotBlocked(page, retailerName = 'retailer') {
  const test = () =>
    page.evaluate(() => {
      const t = `${document.title} ${(document.body?.innerText || '').slice(0, 600)}`;
      return /attention required|just a moment|access denied|you have been blocked|verify you are (a )?human|unusual traffic|checking your browser/i.test(t);
    });
  let blocked = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      blocked = await test();
      break;
    } catch {
      // the interstitial navigates/reloads; wait for it to settle and look again
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  if (blocked) throw new Error(`${retailerName} served a bot-protection page (blocked from this network)`);
}
