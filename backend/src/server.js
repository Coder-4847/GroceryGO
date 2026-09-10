import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { createLogger } from './lib/logger.js';
import { cache } from './lib/cache.js';
import { search } from './search.js';
import { RETAILER_LIST } from './scrapers/retailers.js';
import { closeBrowser, getBrowser } from './lib/browser.js';

const log = createLogger('server');
const app = express();

app.set('trust proxy', 1);
app.use(compression());
app.use(morgan('tiny'));
app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser clients (curl, tests) and any explicitly allowed origin
      if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
        return cb(null, true);
      }
      // also allow any *.github.io by default so a Pages deploy just works
      if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptimeSec: Math.round(process.uptime()), cacheEntries: cache.size });
});

app.get('/retailers', (_req, res) => {
  res.json({ retailers: RETAILER_LIST });
});

const searchLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down a little.' },
});

app.get('/search', searchLimiter, async (req, res) => {
  const item = String(req.query.item || req.query.q || '').trim();
  if (!item) return res.status(400).json({ error: 'Missing ?item= query parameter' });
  if (item.length > 60) return res.status(400).json({ error: 'Query too long' });

  const only = String(req.query.only || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fresh = req.query.fresh === '1' || req.query.nocache === '1';

  try {
    const payload = await search(item, { only, fresh });
    res.json(payload);
  } catch (err) {
    log.error(`/search crashed: ${err.stack || err.message}`);
    res.status(500).json({ error: 'Search failed unexpectedly' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Bind 0.0.0.0 explicitly — PaaS platforms (Render, Railway, Fly) route to the
// container by IP and won't see a localhost-only listener.
const server = app.listen(config.port, '0.0.0.0', () => {
  log.info(`GroceryGO API listening on 0.0.0.0:${config.port}`);
  log.info(`CORS origins: ${config.corsOrigins.join(', ')} (+ *.github.io)`);

  // Warm the browser (and start Xvfb) now, in the background, so the first real
  // search doesn't pay the cold-start cost and time out.
  getBrowser()
    .then(() => log.info('browser pre-warmed'))
    .catch((err) => log.warn(`browser pre-warm failed (will retry on first search): ${err.message}`));
});

server.on('error', (err) => {
  log.error(`server failed to start: ${err.message}`);
  process.exit(1);
});

async function shutdown(sig) {
  log.info(`${sig} received, shutting down`);
  server.close(() => log.info('http server closed'));
  await closeBrowser();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
