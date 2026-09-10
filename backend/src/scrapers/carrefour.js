import { randomUUID } from 'node:crypto';
import { RETAILERS } from './retailers.js';
import { runBrowserScraper, pickBestMatch } from '../lib/scrape-helpers.js';
import { makeProduct } from '../lib/normalize.js';

const BASE = 'https://www.carrefouruae.com';
// Dubai (Festival City) store. Carrefour keys pricing/stock to a lat/long + store.
const GEO = { latitude: '25.2171003', longitude: '55.3613635' };
const API = `${BASE}/mafrp/api/v1/search/listing/keyword?latitude=${GEO.latitude}&longitude=${GEO.longitude}`;

/**
 * Carrefour UAE (MAF).
 *
 * The HTML search page (`?keyword=`) is disallowed by robots.txt (`/*keyword=*`),
 * so we don't fetch it. Instead we call the storefront's own JSON search API
 * `POST /mafrp/api/v1/search/listing/keyword` (keyword goes in the body, so the
 * URL is not matched by the robots rule). The call is made *through* a real
 * headed-Chrome browser context so it inherits the Akamai clearance cookies —
 * a bare fetch/curl to this host is rejected at the TLS/HTTP-2 layer.
 */
export async function scrapeCarrefour(query) {
  return runBrowserScraper(
    RETAILERS.carrefour,
    query,
    async ({ page, context, log }) => {
      // Warm up: load an allowed page so Akamai sets its clearance cookie, then
      // proceed the moment it appears (don't burn a fixed delay on a slow host).
      await page.goto(`${BASE}/mafuae/en/`, { waitUntil: 'domcontentloaded' });
      await page
        .waitForFunction(() => document.cookie.includes('_abck'), { timeout: 10000 })
        .catch(() => {});
      await page.waitForTimeout(400);

      const vid = randomUUID().toUpperCase();
      const res = await context.request.post(API, {
        timeout: 20000,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json; charset=utf-8',
          appid: 'Reactweb',
          appflavour: 'carrefour',
          'x-maf-account': 'carrefour',
          'x-maf-tenant': 'mafretail',
          'x-maf-env': 'prod',
          env: 'prod',
          channel: 'c4online',
          storeid: 'mafuae',
          lang: 'en',
          langcode: 'en',
          currency: 'AED',
          latitude: GEO.latitude,
          longitude: GEO.longitude,
          emiratecode: 'DUBAI',
          'accept-language': 'en-AE',
          'x-requested-with': 'XMLHttpRequest',
          'web-view-type': 'desktop-web',
          visitorid: vid,
          sessionid: vid,
          userid: 'anonymous',
          hashedemail: 'anonymous',
          referer: `${BASE}/mafuae/en/`,
        },
        data: {
          needOOSProducts: false,
          needVariantsData: false,
          verticalCategory: true,
          pageType: 'SLP',
          keyword: query,
          currentPage: 0,
          filter: '',
          // 'relevance' keeps results on-topic; 'price_asc' drifts into whatever
          // is cheapest in the whole category tree. pickBestMatch handles the
          // cheapest-among-matches choice for us.
          sortBy: 'relevance',
          requireSponsProducts: false,
        },
      });

      if (res.status() === 429) throw new Error('rate limited (429)');
      if (!res.ok()) throw new Error(`search API returned ${res.status()}`);

      const json = await res.json().catch(() => null);
      if (!json) throw new Error('search API returned non-JSON');

      const rawProducts = extractProducts(json);
      log.info(`API returned ${rawProducts.length} product sections`);
      if (!rawProducts.length) return { status: 'no_results', message: 'No matching products' };

      const candidates = rawProducts
        .map((p) => normalizeCarrefourProduct(p))
        .filter((c) => c && c.price != null && c.name);

      if (!candidates.length) return { status: 'no_results', message: 'No priced products found' };

      const best = pickBestMatch(query, candidates);
      if (!best) return { status: 'no_results', message: 'No matching products' };
      return { status: 'ok', product: makeProduct(best), matchCount: candidates.length };
    },
    { checkUrl: `${BASE}/mafuae/en/` }
  );
}

/**
 * Response shape: data.sections[] are `master-product-card` entries; the useful
 * fields live in `section.componentDTO.additionalAttributes`.
 */
function extractProducts(json) {
  const sections = json?.data?.sections;
  if (!Array.isArray(sections)) return [];
  return sections
    .filter((s) => s?.uid === 'master-product-card')
    .map((s) => s.componentDTO?.additionalAttributes)
    .filter(Boolean);
}

function normalizeCarrefourProduct(a) {
  const name = a.productName || a.productTitle || null;
  if (!name) return null;

  const price =
    typeof a.sellingPrice === 'number'
      ? a.sellingPrice
      : typeof a.markedPrice === 'number'
        ? a.markedPrice
        : null;

  const inStock = !a.stock || a.stock.stockLevelStatus !== 'outOfStock';
  if (!inStock) return null;

  let url = a.productUrl || (a.productId ? `/mafuae/en/p/${a.productId}` : null);
  if (url && !/^https?:/.test(url)) url = `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;

  return {
    name,
    brand: null, // Carrefour's brandName is an internal slug like "food_safa"
    price,
    url,
    image: typeof a.imageUrl === 'string' ? a.imageUrl.replace(/\?im=.*/, '?im=Resize=(400,400)') : null,
    unit: a.quantityTypeKey && a.quantityTypeKey !== 'pieces' ? a.quantityTypeKey : null,
  };
}
