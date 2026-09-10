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
    order: 1,
  },
  lulu: {
    id: 'lulu',
    name: 'Lulu Hypermarket',
    color: '#00A54F',
    homepage: 'https://gcc.luluhypermarket.com/en-ae',
    host: 'gcc.luluhypermarket.com',
    order: 2,
  },
  noon: {
    id: 'noon',
    name: 'Noon',
    color: '#FEEE00',
    homepage: 'https://www.noon.com/uae-en',
    host: 'www.noon.com',
    order: 3,
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon.ae',
    color: '#FF9900',
    homepage: 'https://www.amazon.ae',
    host: 'www.amazon.ae',
    order: 4,
  },
};

export const RETAILER_LIST = Object.values(RETAILERS).sort((a, b) => a.order - b.order);
