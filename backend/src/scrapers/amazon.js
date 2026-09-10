import { RETAILERS } from './retailers.js';
import { runBrowserScraper, pickBestMatch } from '../lib/scrape-helpers.js';
import { makeProduct, absoluteUrl } from '../lib/normalize.js';

const BASE = 'https://www.amazon.ae';
const searchUrl = (q) => `${BASE}/s?k=${encodeURIComponent(q)}&ref=nb_sb_noss`;

// Per the project brief: Amazon has strong bot detection and may be permanently
// unreliable. When it blocks us we surface this exact message and move on — we do
// NOT fall back to the paid Product Advertising API.
const UNAVAILABLE_MSG = 'Amazon — unable to retrieve data';

/**
 * Amazon.ae search scraper. `/s?k=` is allowed by robots.txt. Results use the
 * long-stable `[data-component-type="s-search-result"]` card with
 * `span.a-price span.a-offscreen` for price — but Amazon frequently serves a
 * CAPTCHA / "Continue shopping" interstitial instead, which we detect and treat
 * as unavailable.
 */
export async function scrapeAmazon(query) {
  return runBrowserScraper(
    RETAILERS.amazon,
    query,
    async ({ page, log }) => {
      await page.goto(searchUrl(query), { waitUntil: 'domcontentloaded' });

      if (await looksBlocked(page)) {
        log.warn('hit a CAPTCHA / bot wall');
        return { status: 'unavailable', message: UNAVAILABLE_MSG };
      }

      const resultSel = '[data-component-type="s-search-result"]';
      const outcome = await Promise.race([
        page.waitForSelector(resultSel, { timeout: 15000 }).then(() => 'products'),
        page
          .waitForSelector('text=/no results for|did not match any products/i', { timeout: 15000 })
          .then(() => 'empty')
          .catch(() => null),
      ]).catch(() => null);

      if (outcome === 'empty') return { status: 'no_results', message: 'No matching products' };
      if (outcome !== 'products') {
        if (await looksBlocked(page)) return { status: 'unavailable', message: UNAVAILABLE_MSG };
        throw new Error('search results did not render');
      }

      await page.evaluate(() => window.scrollBy(0, 1600)).catch(() => {});
      await page.waitForTimeout(900);

      const items = await page.$$eval(resultSel, (cards) => {
        const out = [];
        for (const card of cards) {
          const asin = card.getAttribute('data-asin');
          const priceOff = card.querySelector('.a-price .a-offscreen')?.textContent || '';
          if (!priceOff) continue; // skip sponsored/no-price rows

          const titleEl =
            card.querySelector('h2 a span') ||
            card.querySelector('h2 span') ||
            card.querySelector('[data-cy="title-recipe"] span');
          const name = (titleEl?.textContent || '').replace(/\s+/g, ' ').trim();
          if (!name) continue;

          const linkEl = card.querySelector('h2 a, a.a-link-normal.s-no-outline');
          const href = linkEl?.getAttribute('href') || (asin ? `/dp/${asin}` : null);
          const img = card.querySelector('img.s-image')?.getAttribute('src') || null;

          out.push({ name, priceText: priceOff, href, img, asin });
        }
        return out;
      });

      log.info(`parsed ${items.length} candidates`);
      if (!items.length) return { status: 'no_results', message: 'No priced products found' };

      const candidates = items.map((it) => ({
        name: it.name,
        price: it.priceText,
        // Prefer a clean canonical /dp/<ASIN> link over the tracking-laden href.
        url: it.asin ? `${BASE}/dp/${it.asin}` : absoluteUrl(it.href, BASE),
        image: it.img,
      }));

      const best = pickBestMatch(query, candidates);
      if (!best) return { status: 'no_results', message: 'No matching products' };

      return { status: 'ok', product: makeProduct(best), matchCount: candidates.length };
    },
    {
      checkUrl: searchUrl(query),
      loadImages: true,
      noRoutes: true, // amazon.ae + request interception => "Download is starting"
      unavailableMessage: UNAVAILABLE_MSG,
    }
  );
}

async function looksBlocked(page) {
  try {
    const url = page.url();
    if (/\/errors\/validateCaptcha|\/ap\/cvf|\/gp\/cctv/i.test(url)) return true;
    return await page.evaluate(() => {
      const t = document.body?.innerText || '';
      return (
        !!document.querySelector('form[action*="validateCaptcha"], #captchacharacters') ||
        /enter the characters you see|type the characters you see below|not a robot|sorry, we just need to make sure you're not a robot/i.test(
          t
        ) ||
        /^\s*continue shopping\s*$/i.test(t.trim())
      );
    });
  } catch {
    return false;
  }
}
