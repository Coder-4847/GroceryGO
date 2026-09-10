import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('browser');

let browserPromise = null;
let displayPromise = null;
let contextsServed = 0;
// Recycle the browser process periodically so leaked memory can't build up on a
// small instance. 0 disables.
const RECYCLE_AFTER = Number(process.env.BROWSER_RECYCLE_AFTER ?? 12);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A headed browser needs an X display. In a container there isn't one, so we
 * start Xvfb ourselves the first time a browser is needed — this way it doesn't
 * matter whether the platform runs our Docker CMD, its own start command, or
 * `node src/server.js` directly.
 */
function ensureDisplay() {
  if (displayPromise) return displayPromise;
  displayPromise = (async () => {
    if (config.headless || process.platform !== 'linux') return;

    const display = process.env.DISPLAY || ':99';
    const num = display.replace(/^:/, '').split('.')[0];
    const socket = `/tmp/.X11-unix/X${num}`;

    if (fs.existsSync(socket)) {
      process.env.DISPLAY = display;
      log.info(`using existing X display ${display}`);
      return;
    }

    if (spawnSync('sh', ['-c', 'command -v Xvfb']).status !== 0) {
      log.error('Xvfb is not installed — a headed browser cannot start. Install xvfb or set HEADLESS=1.');
      return;
    }

    try {
      fs.mkdirSync('/tmp/.X11-unix', { recursive: true });
      fs.chmodSync('/tmp/.X11-unix', 0o1777);
    } catch {
      /* best effort */
    }

    log.info(`starting Xvfb on ${display}`);
    const child = spawn(
      'Xvfb',
      [display, '-screen', '0', '1280x800x24', '-nolisten', 'tcp', '-ac', '-noreset'],
      { stdio: 'ignore', detached: true }
    );
    child.on('error', (err) => log.error(`Xvfb spawn error: ${err.message}`));
    child.unref();
    process.env.DISPLAY = display;

    for (let i = 0; i < 50; i++) {
      if (fs.existsSync(socket)) {
        log.info(`Xvfb ready on ${display} after ${i * 200}ms`);
        return;
      }
      await sleep(200);
    }
    log.warn(`Xvfb socket ${socket} did not appear after 10s — launching anyway`);
  })();
  return displayPromise;
}

/**
 * Launch (once) and reuse a single Chromium instance. Each scrape gets its own
 * browser context so cookies/state never leak between retailers.
 */
export async function getBrowser() {
  if (!browserPromise) {
    await ensureDisplay();
    const channel = config.browserChannel && config.browserChannel !== 'chromium'
      ? config.browserChannel
      : undefined;
    log.info(
      `launching browser (channel=${channel || 'bundled-chromium'} headless=${config.headless} DISPLAY=${process.env.DISPLAY || '(unset)'})`
    );
    const started = Date.now();
    browserPromise = chromium
      .launch({
        headless: config.headless,
        channel,
        timeout: 60_000,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--start-maximized',
          // Keep the memory footprint small enough for a 512 MB instance.
          '--renderer-process-limit=1',
          '--js-flags=--max-old-space-size=128',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-back-forward-cache',
          '--disable-features=TranslateUI',
          '--no-first-run',
          '--no-default-browser-check',
          '--mute-audio',
        ],
      })
      .then((b) => {
        log.info(`browser ready in ${Date.now() - started}ms`);
        return b;
      })
      .catch(async (err) => {
        browserPromise = null; // allow a later retry
        // Fall back to bundled Chromium if the system Chrome channel is missing.
        if (channel) {
          log.warn(`channel "${channel}" failed (${err.message}); retrying with bundled chromium`);
          config.browserChannel = 'chromium';
          return getBrowser();
        }
        log.error(`browser launch failed after ${Date.now() - started}ms: ${err.message}`);
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
  if (RECYCLE_AFTER > 0 && contextsServed >= RECYCLE_AFTER && browserPromise) {
    const b = await browserPromise.catch(() => null);
    // only recycle when nothing else is using the browser right now
    if (b && b.contexts().length === 0) {
      log.info(`recycling browser after ${contextsServed} contexts`);
      browserPromise = null;
      contextsServed = 0;
      await b.close().catch(() => {});
    }
  }

  const browser = await getBrowser();
  contextsServed++;
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
