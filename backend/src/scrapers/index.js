import { RETAILERS } from './retailers.js';
import { scrapeCarrefour } from './carrefour.js';
import { scrapeLulu } from './lulu.js';
import { scrapeNoon } from './noon.js';
import { scrapeAmazon } from './amazon.js';

/**
 * Registry mapping retailer id -> scrape function.
 * Each scrape fn signature: (query: string, ctx: { signal }) => Promise<Card>
 * A scraper must NEVER throw for an expected failure (site down, layout change,
 * blocked) — it returns a card with status 'unavailable'. It may throw only for
 * truly unexpected bugs, which the orchestrator catches.
 */
export const SCRAPERS = {
  [RETAILERS.carrefour.id]: scrapeCarrefour,
  [RETAILERS.lulu.id]: scrapeLulu,
  [RETAILERS.noon.id]: scrapeNoon,
  [RETAILERS.amazon.id]: scrapeAmazon,
};

export { RETAILERS };
