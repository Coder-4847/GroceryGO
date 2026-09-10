# GroceryGO

Grocery & household price comparison for the UAE. Type an item — `bread`, `eggs`,
`detergent` — and GroceryGO checks **Carrefour UAE**, **Lulu Hypermarket**,
**Noon** and **Amazon.ae**, shows each retailer's best match and price,
highlights the cheapest, and lets you build a basket with running totals and a
"cheapest overall" summary.

<p align="center"><em>One search. Every price.</em></p>

```
grocerygo/
├── backend/    Node + Express + Playwright scraping API   (GET /search?item=bread)
├── frontend/   React + Vite single-page app               (deploys to GitHub Pages)
└── .github/    Pages deploy workflow
```

The frontend is static — it can't scrape (no server, browser CORS). All scraping
lives in the backend service, which exposes a small REST API the frontend calls.

---

## Quick start (local)

Two terminals.

### 1 · Backend

```bash
cd backend
npm install          # also downloads Playwright's Chromium
cp .env.example .env  # optional — every default works
npm run dev           # http://localhost:3001
```

> **Why a real browser window may flash open:** Carrefour and Noon sit behind
> Akamai, which rejects headless browsers at the HTTP/2 layer. The backend
> launches **real, headed Chrome** by default. On your machine this just works.
> On a headless Linux server, run it under a virtual display — the Docker image
> does this for you (see [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md)).

### 2 · Frontend

```bash
cd frontend
npm install
npm run dev           # http://localhost:5173  (proxies /api → localhost:3001)
```

Open http://localhost:5173.

---

## Testing a scraper directly

```bash
cd backend
node scripts/test-scraper.js lulu "olive oil"     # one retailer
node scripts/test-scraper.js all "brown bread"    # all four, as the API returns them
```

---

## API

| Route                  | Description                                              |
| ---------------------- | ------------------------------------------------------- |
| `GET /search?item=<q>` | Scrape all retailers for `<q>`. `&fresh=1` bypasses cache. `&only=lulu,noon` restricts. |
| `GET /retailers`       | Retailer metadata (name, colour, homepage).            |
| `GET /health`          | Liveness + cache size.                                 |

`/search` response:

```jsonc
{
  "query": "bread",
  "cheapest": "lulu",               // retailer id, or null
  "results": [
    {
      "retailer": "lulu",
      "retailerName": "Lulu Hypermarket",
      "status": "ok",               // ok | no_results | unavailable
      "product": {
        "name": "…", "brand": "…", "price": 3.5,
        "priceFormatted": "AED 3.50", "currency": "AED",
        "image": "https://…", "url": "https://…"    // url → the product page
      },
      "message": null,
      "cached": false,
      "tookMs": 3410
    }
    // …one card per retailer, ok/cheapest first
  ]
}
```

A retailer that fails, blocks, or changes layout comes back as
`status: "unavailable"` — it never breaks the rest of the search.

---

## How each retailer is scraped

| Retailer      | Method | Source | Notes |
| ------------- | ------ | ------ | ----- |
| **Carrefour** | JSON API | `POST /mafrp/api/v1/search/listing/keyword` | The HTML search URL (`?keyword=`) is disallowed by robots.txt; the API (keyword in the body) is not. Called through the browser context so it inherits Akamai clearance. |
| **Lulu**      | DOM    | `/en-ae/list/?search_text=…` | Next.js/Akinon storefront; price in `[data-testid="product-price"]`. |
| **Noon**      | DOM    | `/uae-en/search?q=…` | Catalog API is under robots-disallowed `/_vs/`, so the rendered page is scraped instead. CSS-module class hashes matched by prefix. |
| **Amazon.ae** | DOM    | `/s?k=…` | `span.a-price .a-offscreen`. Volatile bot detection — see below. |

Each scraper is its own module in [`backend/src/scrapers/`](backend/src/scrapers).
Shared concerns (robots.txt, per-host rate limiting, a fresh browser context,
uniform error → `unavailable`) live in
[`scrape-helpers.js`](backend/src/lib/scrape-helpers.js). Results are cached
per-retailer per-query (~20 min; ~3 min for failures) so a retry only re-scrapes
what was stale.

### Amazon.ae

Amazon has aggressive bot detection. The scraper works today, but if Amazon
starts serving CAPTCHAs the card degrades to **"Amazon — unable to retrieve
data"** and the rest of the search is unaffected. This is an **accepted
permanent fallback** — GroceryGO does **not** fall back to Amazon's paid Product
Advertising API.

### Politeness

`robots.txt` is fetched and respected for every retailer (toggle with
`RESPECT_ROBOTS`). Requests to the same host are spaced out
(`PER_HOST_MIN_GAP_MS`, default 1.5 s) and the public API is rate-limited per IP.

---

## Basket

- Add a searched item and GroceryGO stores every retailer's price for it.
- Running totals: **your picks** vs **cheapest per item**, plus **"whole list at
  one store"** when a single retailer can fulfil everything.
- Switch the picked store per line; totals recompute.
- Persisted to `localStorage` — survives refresh, syncs across tabs.

---

## Build status

Built in this order (see commit history):

- [x] 1 · Scaffold (frontend + backend)
- [x] 2 · First scraper end-to-end (**Lulu**), verified with live queries
- [x] 3 · Carrefour (JSON API), Noon (DOM), Amazon (DOM) — all live-tested
- [x] 4 · Search API ↔ frontend
- [x] 5 · Basket (localStorage)
- [x] 6 · UI / animation polish
- [ ] 7 · GitHub Pages + backend hosting — config is ready; run when you provide the repo

---

## Deployment

Config and step-by-step guides are in place:

- [frontend/DEPLOYMENT.md](frontend/DEPLOYMENT.md) — GitHub Pages via the included
  Actions workflow.
- [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) — Docker image + Render / Railway
  / Fly.io free-tier comparison and trade-offs.

Nothing is deployed yet — that's the last step, once local testing is signed off.

---

## Disclaimer

GroceryGO compares publicly listed prices for personal shopping decisions. Prices
lag by up to ~20 minutes and may differ at checkout. Not affiliated with, or
endorsed by, any retailer. Retailer names and colours are used nominatively; no
retailer trademarks or logos are redistributed.
