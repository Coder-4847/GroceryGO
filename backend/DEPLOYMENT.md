# Deploying the GroceryGO backend

The backend drives Chromium via Playwright. **Carrefour and Noon block *headless*
browsers at the Akamai layer**, so it must run **headed**, under a virtual
display (`xvfb`) on a server. The included `Dockerfile` handles this. (Headed
bundled Chromium is enough — it does not need to be Google Chrome.)

## What the backend needs

- Node 20+
- Chromium + its system libraries (`playwright install --with-deps chromium`)
- `xvfb` (virtual framebuffer) so Chromium can run "headed" in a headless container
- ~512 MB RAM minimum; 1 GB is comfortable (the browser is the memory hog)
- Outbound HTTPS to the four retailer domains

The `Dockerfile` starts from `node:20-bookworm-slim`, adds Chromium + xvfb, and
launches with `xvfb-run … node src/server.js`. (The full
`mcr.microsoft.com/playwright` image also works but is ~2 GB and stalls small
free-tier builders.)

## Environment variables

| Var                  | Prod value                                   | Notes |
| -------------------- | -------------------------------------------- | ----- |
| `CORS_ORIGINS`       | `https://<user>.github.io`                   | Your Pages origin. `*.github.io` is already allowed by default, so this is optional. |
| `HEADLESS`           | `0`                                          | Must stay headed. |
| `BROWSER_CHANNEL`    | `chromium`                                   | `chromium` = Playwright's bundled build (what the Docker image installs). Use `chrome` only if you've installed Google Chrome in the image. |
| `SCRAPER_CONCURRENCY`| `2` on tiny instances, `4` otherwise         | Each retailer = one browser tab. |
| `CACHE_TTL_MS`       | `1800000` (30 min)                           | Longer = fewer scrapes = friendlier + faster. |
| `PORT`               | set by the host automatically                | |

## Free-tier hosting options

> **Reality check:** a headed browser wants ~1 GB RAM and real CPU. The 512 MB /
> shared-CPU free tiers below (Render, Railway, Koyeb…) technically run it but
> searches are slow (~60–90 s) and can crash under load. For a genuinely free
> setup that performs, use **Oracle Cloud Always Free** — see
> [`../deploy/oracle/README.md`](../deploy/oracle/README.md). The options below
> are fine for a demo.


### Render (recommended — simplest Docker path)
- A `render.yaml` blueprint is included **at the repo root** (Render only looks
  there). New → Blueprint → pick this repo → Apply.
- Free web service: 512 MB RAM, spins down after ~15 min idle (first request
  after a spin-down takes ~30–60 s while the browser cold-starts).
- Docker builds are supported on free tier — keep the image small (this one is
  ~700 MB; the full Playwright image is too big and the build stalls).
- **Trade-off:** the 512 MB cap is tight with a browser — keep
  `SCRAPER_CONCURRENCY=2` and expect the occasional retailer to time out under load.

### Railway
- Detects the `Dockerfile` automatically. Set the root directory to `backend`.
- Free trial credit (~$5/mo), then usage-billed; no forced sleep while you have
  credit. More RAM headroom than Render free.
- **Trade-off:** not a permanently-free tier — it burns trial credit.

### Fly.io
- `fly launch` in `backend/` (it picks up the `Dockerfile`). Pick a region near
  the UAE (`fra` or `bom`) for lower latency to the retailers.
- Free allowance covers a small shared-CPU VM; scale to 512–1024 MB.
- Add `[http_service] auto_stop_machines = true` to sleep when idle.
- **Trade-off:** most setup steps; needs a credit card on file even for free use.

### Not recommended
- **Vercel / Netlify / Cloudflare Workers / GitHub Pages** — no persistent
  process, no room for a real browser. Won't work for this backend.

## After deploying

1. Grab the service URL, e.g. `https://grocerygo-api.onrender.com`.
2. Set the frontend's `VITE_API_BASE` to that URL (see
   [../frontend/DEPLOYMENT.md](../frontend/DEPLOYMENT.md)).
3. Smoke-test:
   ```bash
   curl "https://grocerygo-api.onrender.com/health"
   curl "https://grocerygo-api.onrender.com/search?item=milk"
   ```

## Running the container locally

```bash
cd backend
docker build -t grocerygo-api .
docker run -p 3001:3001 -e CORS_ORIGINS=http://localhost:5173 grocerygo-api
```

## If a scraper starts failing in production

- One retailer failing is expected and handled — its card shows "unavailable".
- All four failing usually means the instance ran out of memory (lower
  `SCRAPER_CONCURRENCY`) or the host IP got rate-limited (raise `CACHE_TTL_MS`,
  `PER_HOST_MIN_GAP_MS`).
- Set `DEBUG_ARTIFACTS=1` to dump the page HTML + a screenshot to
  `./scraper-debug` on failure.
- Amazon specifically may block permanently — that's the documented fallback,
  not a regression.
