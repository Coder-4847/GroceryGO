import 'dotenv/config';

/**
 * Central configuration. Everything tunable lives here so scrapers stay declarative.
 */
export const config = {
  port: Number(process.env.PORT) || 3001,

  // Comma-separated list of allowed frontend origins for CORS.
  // Defaults cover local Vite dev + a GitHub Pages style origin.
  corsOrigins: (process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Cache TTL for a successful search query result, in milliseconds.
  cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 20 * 60 * 1000, // 20 min
  // Shorter TTL when a retailer came back unavailable, so we retry sooner.
  cacheErrorTtlMs: Number(process.env.CACHE_ERROR_TTL_MS) || 3 * 60 * 1000,

  // Hard ceiling for a single retailer scrape. The orchestrator will give up
  // on a slow retailer and mark it unavailable rather than hang the whole search.
  scraperTimeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS) || 25 * 1000,

  // Max retailers scraped concurrently. Each uses its own browser context.
  scraperConcurrency: Number(process.env.SCRAPER_CONCURRENCY) || 4,

  // Politeness: minimum gap between two hits to the same retailer host.
  perHostMinGapMs: Number(process.env.PER_HOST_MIN_GAP_MS) || 1500,

  // Global API rate limit (per IP).
  rateLimit: {
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 20,
  },

  // IMPORTANT: Carrefour and Noon sit behind Akamai, which rejects headless
  // Chromium at the HTTP/2 layer (net::ERR_HTTP2_PROTOCOL_ERROR). Running the
  // real Chrome build in HEADED mode gets through. On a headless Linux server
  // you must wrap the process in a virtual display, e.g. `xvfb-run -a npm start`.
  // Set HEADLESS=1 to force headless anyway (Lulu/Amazon still work; the other
  // two will usually degrade to "unavailable").
  headless: process.env.HEADLESS === '1',

  // Browser channel: 'chrome' uses the system Chrome install (best anti-bot
  // results). Set BROWSER_CHANNEL=chromium to use Playwright's bundled build.
  browserChannel: process.env.BROWSER_CHANNEL ?? 'chrome',

  // Persist HTML/screenshots of failed scrapes to ./scraper-debug for triage.
  debugArtifacts: process.env.DEBUG_ARTIFACTS === '1',

  // Respect robots.txt disallow rules (recommended on). Set to '0' only for
  // local debugging of a specific selector.
  respectRobots: process.env.RESPECT_ROBOTS !== '0',

  userAgent:
    process.env.SCRAPER_UA ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',

  // UAE locale defaults used across scrapers.
  locale: 'en-AE',
  timezone: 'Asia/Dubai',
  currency: 'AED',
};
