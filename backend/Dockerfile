# GroceryGO scraping API.
#
# Uses the official Playwright image, which bundles Chromium, every system
# library it needs, plus xvfb + fonts. We need HEADED Chrome — Carrefour and Noon
# reject headless browsers at the Akamai layer — so the container:
#   1. installs the real Google Chrome build (`playwright install chrome`), and
#   2. starts the server under a virtual framebuffer with `xvfb-run`.
FROM mcr.microsoft.com/playwright:v1.47.2-jammy

ENV NODE_ENV=production \
    HEADLESS=0 \
    BROWSER_CHANNEL=chrome \
    PORT=3001

WORKDIR /app

COPY package*.json ./
# Deps only; the base image already has Chromium so skip the postinstall.
RUN npm ci --omit=dev --ignore-scripts \
 && npx playwright install chrome

COPY . .

EXPOSE 3001

# xvfb-run gives Chrome a display so it runs "headed" inside a headless container.
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1366x900x24", "node", "src/server.js"]
