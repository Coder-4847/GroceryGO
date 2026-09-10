import { RETAILERS } from './retailers.js';
import { runBrowserScraper, pickBestMatch } from '../lib/scrape-helpers.js';
import { makeProduct, absoluteUrl } from '../lib/normalize.js';

const BASE = 'https://www.noon.com';
const searchUrl = (q) => `${BASE}/uae-en/search?q=${encodeURIComponent(q)}`;

/**
 * Noon (noon.com/uae-en).
 *
 * Noon's catalog API lives under /_vs/ and /_svc/, both disallowed by
 * robots.txt, so we scrape the (allowed) rendered search page instead. Products
 * are React-rendered cards: an <a href="/uae-en/<slug>/<id>/p/"> wrapping an
 * <img>, with the price in <strong class="_amount_…">. Class hashes change
 * between deploys, so selectors match on the stable class-name *prefix*.
 * Product names are cross-checked against the page's JSON-LD ItemList.
 */
export async function scrapeNoon(query) {
  return runBrowserScraper(
    RETAILERS.noon,
    query,
    async ({ page, log }) => {
      await page.goto(searchUrl(query), { waitUntil: 'domcontentloaded' });

      const outcome = await Promise.race([
        page.waitForSelector('a[href*="/p/"] img', { timeout: 15000 }).then(() => 'products'),
        page
          .waitForSelector('text=/no results|couldn.t find|0 results found/i', { timeout: 15000 })
          .then(() => 'empty')
          .catch(() => null),
      ]).catch(() => null);

      if (outcome === 'empty') return { status: 'no_results', message: 'No matching products' };
      if (!outcome) throw new Error('search results did not render');

      // A short scroll to trigger the first rows of lazy images/alt text. The
      // per-pick second pass below fetches the chosen product's image if this
      // didn't reach it — cheaper than scrolling the whole grid every time.
      await page.evaluate(() => window.scrollTo(0, 1200)).catch(() => {});
      await page
        .waitForSelector('a[href*="/p/"] img[src*="nooncdn.com/p/"]', { timeout: 2500 })
        .catch(() => {});
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

      const items = await page.evaluate(() => {
        // JSON-LD ItemList: id -> name
        const ldNames = {};
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            const j = JSON.parse(s.textContent);
            if (j['@type'] === 'ItemList' && Array.isArray(j.itemListElement)) {
              for (const it of j.itemListElement) {
                const m = (it.url || '').match(/\/([A-Z]\d+[A-Z]?)\/p\//);
                if (m) ldNames[m[1]] = it.name;
              }
            }
          } catch {
            /* ignore */
          }
        }

        const seen = new Set();
        const out = [];

        for (const a of document.querySelectorAll('a[href*="/p/"]')) {
          if (!a.querySelector('img')) continue;
          const rawHref = a.getAttribute('href') || '';
          const href = rawHref.split('?')[0];
          const idMatch = href.match(/\/([A-Z]\d+[A-Z]?)\/p\//);
          const id = idMatch ? idMatch[1] : href;
          if (seen.has(id)) continue;

          let box = a;
          for (let i = 0; i < 5 && box.parentElement; i++) {
            if (box.querySelector('[class*="ellingPrice" i], strong[class*="mount" i]')) break;
            box = box.parentElement;
          }
          const priceEl =
            box.querySelector('[class*="ellingPrice" i] [class*="mount" i]') ||
            box.querySelector('strong[class*="mount" i]');
          if (!priceEl) continue;
          const priceText = (priceEl.textContent || '').replace(/[^\d.]/g, '');
          if (!priceText) continue;

          const imgEl2 = a.querySelector('img');
          const cleanAlt = (s) =>
            (s || '')
              .replace(/\s*[-–]\s*Image\s*\d+\s*$/i, '')
              .trim();
          // name priority: image alt (carries brand) -> data-qa attr -> JSON-LD.
          // Never fall back to raw card text — it mixes in price/rating/badges.
          let name = cleanAlt(imgEl2?.getAttribute('alt'));
          if (!name || /^placeholder$/i.test(name)) {
            const qa = box.querySelector('[data-qa^="productImagePLP_"]')?.getAttribute('data-qa');
            name = qa ? qa.replace(/^productImagePLP_/, '').trim() : '';
          }
          if (!name) name = ldNames[id] || '';
          if (!name) continue;
          seen.add(id);

          const imgSrc =
            imgEl2?.getAttribute('src') || imgEl2?.currentSrc || imgEl2?.getAttribute('data-src') || null;
          const realImg =
            imgSrc && /nooncdn\.com\/p\//i.test(imgSrc) && !/placeholder/i.test(imgSrc)
              ? imgSrc
              : null;

          out.push({ name, priceText, href: rawHref, img: realImg });
        }
        return out;
      });

      log.info(`parsed ${items.length} candidates`);
      if (!items.length) return { status: 'no_results', message: 'No priced products found' };

      const candidates = items.map((it) => ({
        name: it.name,
        price: it.priceText,
        url: absoluteUrl(it.href, BASE),
        image: it.img,
      }));

      const best = pickBestMatch(query, candidates);
      if (!best) return { status: 'no_results', message: 'No matching products' };

      // If the chosen product's photo hadn't lazy-loaded, scroll to it and retry.
      if (!best.image && best.url) {
        const id = (best.url.match(/\/([A-Z]\d+[A-Z]?)\/p\//) || [])[1];
        if (id) {
          const loc = page.locator(`a[href*="${id}/p/"] img`).first();
          await loc.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
          await page
            .waitForSelector(`a[href*="${id}/p/"] img[src*="nooncdn.com/p/"]`, { timeout: 2500 })
            .catch(() => {});
          const src = await loc.getAttribute('src').catch(() => null);
          if (src && /nooncdn\.com\/p\//.test(src)) best.image = src;
        }
      }

      return { status: 'ok', product: makeProduct(best), matchCount: candidates.length };
    },
    { checkUrl: searchUrl(query), loadImages: true }
  );
}
