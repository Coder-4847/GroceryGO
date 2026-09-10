import { RETAILERS } from './retailers.js';
import { runBrowserScraper, pickBestMatch } from '../lib/scrape-helpers.js';
import { makeProduct, absoluteUrl } from '../lib/normalize.js';

const BASE = 'https://gcc.luluhypermarket.com';
const searchUrl = (q) => `${BASE}/en-ae/list/?search_text=${encodeURIComponent(q)}`;

/**
 * Lulu Hypermarket (gcc.luluhypermarket.com) — Next.js storefront on the Akinon
 * platform, behind Cloudflare. Products render as server components; each card is
 * an <a href="/en-ae/<slug>/p/<id>/"> with a <span data-testid="product-price">.
 */
export async function scrapeLulu(query) {
  return runBrowserScraper(
    RETAILERS.lulu,
    query,
    async ({ page, log }) => {
      await page.goto(searchUrl(query), { waitUntil: 'domcontentloaded' });

      // Either product prices show up, or the "no results" state does.
      const priceSel = '[data-testid="product-price"]';
      const outcome = await Promise.race([
        page.waitForSelector(priceSel, { timeout: 18000 }).then(() => 'products'),
        page
          .waitForSelector('text=/no results|couldn.t find|0 results/i', { timeout: 18000 })
          .then(() => 'empty')
          .catch(() => null),
      ]).catch(() => null);

      if (outcome === 'empty') return { status: 'no_results', message: 'No matching products' };

      // Nudge lazy-loaded cards in.
      await page.evaluate(() => window.scrollBy(0, 1400)).catch(() => {});
      await page.waitForTimeout(500);

      const items = await page.$$eval(priceSel, (priceNodes) => {
        const seen = new Set();
        const out = [];
        for (const priceEl of priceNodes) {
          // climb to the smallest ancestor that also holds the product link
          let card = priceEl;
          for (let i = 0; i < 8 && card; i++) {
            if (card.querySelector && card.querySelector('a[href*="/p/"]')) break;
            card = card.parentElement;
          }
          if (!card) continue;
          const link =
            card.querySelector('a[data-testid][href*="/p/"]') ||
            card.querySelector('a[href*="/p/"]');
          if (!link) continue;
          const href = link.getAttribute('href');
          if (!href || seen.has(href)) continue;
          seen.add(href);

          const name =
            (link.getAttribute('data-testid') || '').replace(/-\d+$/, '').trim() ||
            (link.textContent || '').trim();
          const brand = (card.querySelector('span[class*="bg-primary"]')?.textContent || '').trim();
          const priceText = (priceEl.textContent || '').replace(/[^\d.,]/g, '').trim();

          // The product photo lives on a sibling image-anchor a few levels up,
          // not inside the price/info block. Widen the search and skip badges.
          let wide = card;
          for (let i = 0; i < 3 && wide.parentElement; i++) wide = wide.parentElement;
          const pickImg = (root) => {
            const imgs = [...root.querySelectorAll('img')];
            const real = imgs.find((im) => {
              const s = im.getAttribute('src') || im.getAttribute('data-src') || '';
              return /cloudcdn|\/products\/|akinon/i.test(s) && !/badge|icon|logo|flag/i.test(s);
            });
            return real?.getAttribute('src') || real?.getAttribute('data-src') || null;
          };
          const img = pickImg(wide) || pickImg(card) || null;

          if (name && priceText) out.push({ name, brand, priceText, href, img });
        }
        return out;
      });

      log.info(`parsed ${items.length} candidates`);
      if (!items.length) return { status: 'no_results', message: 'No matching products' };

      const candidates = items.map((it) => ({
        name: it.name,
        brand: it.brand,
        price: it.priceText,
        url: absoluteUrl(it.href, BASE),
        image: it.img,
      }));

      const best = pickBestMatch(query, candidates);
      if (!best) return { status: 'no_results', message: 'No priced products found' };

      return {
        status: 'ok',
        product: makeProduct(best),
        matchCount: candidates.length,
      };
    },
    { checkUrl: searchUrl(query), loadImages: false }
  );
}
