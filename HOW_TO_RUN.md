# How to run GroceryGO (local only)

This app currently runs **locally only** — there is no live website. The GitHub
repo and the Render backend were both deleted (see `PROJECT_STATUS.md` for why
and what that means if you ever want to put it back online).

## Every time you want to use it

Two terminals, both left open while you use the app.

**Terminal 1 — backend:**
```bash
cd backend
npm run dev
```
Wait for `GroceryGO API listening on 0.0.0.0:3001`. A Chrome window will pop up
each time you search — that's normal, it's the scraper. Don't close it.

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```
Wait for `Local: http://localhost:5173`.

Then open **http://localhost:5173** in your browser and search any grocery item.

To stop: click each terminal and press `Ctrl+C`.

## First time only (or after pulling new code)

Before the steps above, in **both** `backend/` and `frontend/` folders:
```bash
npm install
```
(`backend`'s install also downloads a Chromium build — a few minutes the first
time.)

## Confirming it's really live data

- Every search opens a real browser and reads the current price off Carrefour,
  Lulu, Noon, and Amazon.ae directly — nothing is faked or pre-recorded.
- Results are cached for ~20 minutes per search term so repeat searches are
  instant. Add `&fresh=1` to a direct API call (or just wait 20 min) to force a
  re-scrape. Restarting the backend clears the cache.

## Quick troubleshooting

| Problem | Fix |
| ------- | --- |
| "Could not reach the GroceryGO server" in the browser | The backend terminal isn't running, or crashed — check it, restart with `npm run dev`. |
| A retailer's card always says "unavailable" | Normal occasionally — that site changed something or blocked a request. Try again; if it's *every* search, tell Claude the retailer name so the scraper can be checked. |
| Amazon card says "Amazon — unable to retrieve data" | Expected/by design if Amazon's bot detection kicks in — not a bug. |
| Chrome window keeps appearing | Expected — the scraper needs a real (visible) browser to get past retailer bot-detection. |
| Port already in use | Something else is already running on 3001 or 5173. Close old terminals, or `Ctrl+C` and retry. |

## Testing one scraper directly (no frontend needed)

```bash
cd backend
node scripts/test-scraper.js lulu "olive oil"
node scripts/test-scraper.js all "bread"
```

## If you want it back online

See `PROJECT_STATUS.md` — the deployment config (Docker, Render, Oracle Cloud
guide) is still in the repo, just unused. Nothing needs to be rebuilt, only
reconnected.
