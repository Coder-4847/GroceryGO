import { chromium } from 'playwright';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('browser');

let browserPromise = null;

/**
 * Launch (once) and reuse a single Chromium instance. Each scrape gets its own
 * browser context so cookies/state never leak between retailers.
 */
export async function getBrowser() {
  if (!browserPromise) {
    const channel = config.browserChannel && config.browserChannel !== 'chromium'
      ? config.browserChannel
      : undefined;
    log.info(
      `launching browser (channel=${channel || 'bundled-chromium'} headless=${config.headless})`
    );
    browserPromise = chromium
      .launch({
        headless: config.headless,
        channel,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--start-maximized',
        ],
      })
      .catch(async (err) => {
        browserPromise = null; // allow a later retry
        // Fall back to bundled Chromium if the system Chrome channel is missing.
        if (channel) {
          log.warn(`channel "${channel}" failed (${err.message}); retrying with bundled chromium`);
          config.browserChannel = 'chromium';
          return getBrowser();
        }
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Create a fresh, lightly-hardened context. Blocks images/media/fonts by default
 * to keep scrapes fast and cheap; pass { loadImages: true } when a scraper needs
 * product thumbnails.
 */
export async function newContext({ loadImages = false, noRoutes = false } = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: config.userAgent,
    locale: config.locale,
    timezoneId: config.timezone,
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1,
    javaScriptEnabled: true,
    serviceWorkers: 'block',
    extraHTTPHeaders: {
      'Accept-Language': 'en-AE,en;q=0.9,ar;q=0.8',
    },
  });

  // Mask the most obvious automation tells.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-AE', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = window.chrome || { runtime: {} };
  });

  // Request interception speeds pages up, but on some sites (notably amazon.ae)
  // enabling it at all makes Chromium mis-handle the gzipped document as a
  // download ("Download is starting"). Those scrapers pass `noRoutes: true`.
  if (!noRoutes) {
    const trackers =
      /googletagmanager|google-analytics|analytics\.google|doubleclick|facebook\.net|connect\.facebook|hotjar|clarity\.ms|snowplow|criteo|taboola|outbrain|bat\.bing|amazon-adsystem|adsrvr\.org/i;
    await context.route(trackers, (route) => route.abort().catch(() => {}));

    if (!loadImages) {
      await context.route(
        /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|m4v|m4a|mp3)(\?|$)/i,
        (route) => route.abort().catch(() => {})
      );
    }
  }

  return context;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    /* already gone */
  }
  browserPromise = null;
}
