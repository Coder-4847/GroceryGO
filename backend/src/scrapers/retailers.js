/**
 * Retailer metadata. `id` is the stable key used by the frontend and cache.
 * `order` controls display order in the UI before price sorting kicks in.
 */
export const RETAILERS = {
  carrefour: {
    id: 'carrefour',
    name: 'Carrefour UAE',
    color: '#004E9F',
    homepage: 'https://www.carrefouruae.com',
    host: 'www.carrefouruae.com',
    searchTemplate: 'https://www.carrefouruae.com/mafuae/en/search?keyword={q}',
    order: 1,
  },
  lulu: {
    id: 'lulu',
    name: 'Lulu Hypermarket',
    color: '#00A54F',
    homepage: 'https://gcc.luluhypermarket.com/en-ae',
    host: 'gcc.luluhypermarket.com',
    searchTemplate: 'https://gcc.luluhypermarket.com/en-ae/list/?search_text={q}',
    order: 2,
  },
  noon: {
    id: 'noon',
    name: 'Noon',
    color: '#FEEE00',
    homepage: 'https://www.noon.com/uae-en',
    host: 'www.noon.com',
    searchTemplate: 'https://www.noon.com/uae-en/search?q={q}',
    // Noon's robots.txt disallows its search pages, so the catalog does not scrape
    // it: results show a "Search Noon" link instead of a price.
    scrapeInCatalog: false,
    order: 3,
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon.ae',
    color: '#FF9900',
    homepage: 'https://www.amazon.ae',
    host: 'www.amazon.ae',
    searchTemplate: 'https://www.amazon.ae/s?k={q}',
    order: 4,
  },
};

export const RETAILER_LIST = Object.values(RETAILERS).sort((a, b) => a.order - b.order);
