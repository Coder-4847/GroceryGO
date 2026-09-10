# GroceryGO — frontend

React + Vite single-page app. See the [root README](../README.md) for the full
picture and [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages.

```bash
npm install
npm run dev       # http://localhost:5173, proxies /api → http://localhost:3001
npm run build     # -> dist/
npm run lint
```

Config via env (see [.env.example](.env.example)): `VITE_API_BASE` (deployed
backend URL), `VITE_BASE` (Pages sub-path), `VITE_DEV_API_TARGET` (local proxy
target).

Structure:

- `src/hooks/useSearch.js` — one search request, cancels the previous
- `src/hooks/useBasket.js` — localStorage basket + totals
- `src/lib/api.js` — backend client
- `src/components/` — `SearchBar`, `ResultsGrid` → `ResultCard`, `BasketDrawer`
