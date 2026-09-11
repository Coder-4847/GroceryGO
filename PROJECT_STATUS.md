# Project status — read this first if resuming

**Last updated: 2026-09-11.**

## TL;DR

The app is **fully built and works** — all 4 scrapers, search, basket, UI, all
tested live. It currently only runs **locally** (see `HOW_TO_RUN.md`). There is
**no live website** right now: the GitHub repo and the Render backend were both
**intentionally deleted** by the user. This file explains why, and what to do if
you want it back online.

## What happened (short version)

1. Built the full app (frontend + backend + 4 scrapers) — all working, all
   live-tested. See the "How each retailer is scraped" section that used to be
   in `README.md` / is preserved in git history if you restore it.
2. Deployed frontend to GitHub Pages (worked) and backend to **Render's free
   tier** (worked, but Render free = ~512 MB RAM / ~0.1 CPU, which is not
   enough to run a real browser well — searches took ~60–90 seconds and the
   browser sometimes OOM-crashed mid-search).
3. Tried to move the backend to **Oracle Cloud "Always Free"** (a genuinely
   free tier with enough RAM/CPU to run this properly) — the setup guide and
   scripts are ready in `deploy/oracle/`. **OCI's signup kept rejecting the
   payment-verification step** ("limit exceeded") across several attempts.
4. The user decided not to keep fighting OCI signup for now, and instead:
   - **Deleted the Render service**
   - **Deleted the GitHub repository** (`Coder-4847/GroceryGO`)
   - Kept the code locally and runs it with `npm run dev` (see `HOW_TO_RUN.md`)

Nothing about this reflects a problem with the app itself — it's a hosting
decision. The code is complete and correct.

## Current state of this folder

- `origin` git remote still points at the deleted GitHub URL — harmless, will
  just fail if you ever `git push`/`git pull`. Not a git repo issue otherwise;
  full commit history is intact locally.
- Deployment config is still in the repo, **unused but intact and correct**:
  - `backend/Dockerfile`, `render.yaml` — for Render (or any Docker host)
  - `deploy/oracle/` — full Oracle Cloud Always Free setup (compose file,
    Caddy reverse proxy w/ auto-HTTPS, `setup.sh`, walkthrough README)
  - `.github/workflows/deploy-frontend.yml` — GitHub Pages deploy workflow
  - `backend/DEPLOYMENT.md`, `frontend/DEPLOYMENT.md` — the reasoning/trade-offs
- None of this needs to be rebuilt if you go back online — only reconnected.

## If you (or a future Claude session) want it back online

Don't assume — **ask the user which of these they want** before doing anything,
since it involves their accounts:

1. **Create a new GitHub repo** (or check if they made a new one) and push this
   code to it (`git remote set-url origin <new-url>` or `git remote add origin
   <new-url>`, then push).
2. **Pick a backend host** — this is the real decision:
   - **Retry Oracle Cloud Always Free** — best option if signup finally works
     (free forever, ~15–30 s searches, no sleep). Guide: `deploy/oracle/README.md`.
   - **Render free tier again** — quick to stand up, but expect ~60–90 s
     searches and occasional crash-recovery (the code already handles
     crash-recovery gracefully as of the last commits). Fine as a stopgap.
   - **Something else** (Railway, Fly.io, a VPS the user already has, etc.) —
     ask what's available; all use the same `backend/Dockerfile`.
3. **Re-enable GitHub Pages** on the new repo, set the `API_BASE` repo variable
   to the new backend URL, run the deploy workflow.
4. **Test it end-to-end** — search a few real items, confirm live prices come
   back, confirm the basket persists — before telling the user it's done.

## Also worth checking if resuming after a while

- The scraper selectors were correct as of 2026-09 — retailer sites change
  layouts periodically. If a scraper that used to work now fails on real
  queries, re-run `node backend/scripts/test-scraper.js <retailer> "<query>"`
  to see what broke before assuming it's a deploy problem.
