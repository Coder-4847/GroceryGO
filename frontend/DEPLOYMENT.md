# Deploying the GroceryGO frontend to GitHub Pages

The frontend is a static Vite build. GitHub Pages serves it; it talks to the
separately-hosted backend (see [../backend/DEPLOYMENT.md](../backend/DEPLOYMENT.md)).

## One-time setup

1. Push this repo to GitHub as `grocerygo` (or any name — the workflow adapts).
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Repo **Settings → Secrets and variables → Actions → Variables**, add:
   - `API_BASE` = your backend URL, e.g. `https://grocerygo-api.onrender.com`
     (no trailing slash)
4. Push to `main`. The workflow at
   [`.github/workflows/deploy-frontend.yml`](../.github/workflows/deploy-frontend.yml)
   builds `frontend/` and publishes it.

The workflow sets:
- `VITE_BASE=/<repo-name>/` so asset paths resolve under the project page URL
- `VITE_API_BASE` from the `API_BASE` variable

Your site lands at `https://<user>.github.io/<repo>/`.

## Backend CORS

The backend already allows any `https://*.github.io` origin, so no extra config
is needed. If you serve the frontend from a custom domain, add it to the
backend's `CORS_ORIGINS`.

## Local production preview

```bash
cd frontend
VITE_API_BASE=https://your-backend.example.com npm run build
npm run preview
```

## Manual deploy (without Actions)

```bash
cd frontend
VITE_BASE=/grocerygo/ VITE_API_BASE=https://your-backend npm run build
npx gh-pages -d dist        # or push dist/ to a gh-pages branch
```

## Notes / trade-offs

- **Backend cold starts:** on Render's free tier the first search after ~15 min
  idle waits ~30–60 s for the backend (and its browser) to wake. The UI shows a
  loading state; consider a cheap cron ping to keep it warm.
- **Mixed content:** the backend must be HTTPS (all the suggested hosts are).
- GitHub Pages has no server, so it can never do the scraping itself — that's the
  whole reason the backend is separate.
