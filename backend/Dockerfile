# GroceryGO scraping API.
#
# Slim Node base + just Chromium (not the full Playwright image, which bundles
# Firefox + WebKit and is ~2 GB). We need Chromium running HEADED — Carrefour and
# Noon reject headless browsers at the Akamai layer — so the container runs it
# under a virtual framebuffer with `xvfb-run`. Headed *bundled* Chromium gets
# through; it does not need to be Google Chrome.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    HEADLESS=0 \
    BROWSER_CHANNEL=chromium \
    PORT=3001 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package*.json ./

# 1) node deps (skip the postinstall browser download — we do it explicitly)
# 2) Chromium + all its system libraries, via Playwright's --with-deps
# 3) xvfb so Chromium can run "headed" with no real display
RUN npm ci --omit=dev --ignore-scripts \
 && npx playwright install --with-deps chromium \
 && apt-get update \
 && apt-get install -y --no-install-recommends xvfb \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 3001

CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1366x900x24", "node", "src/server.js"]
