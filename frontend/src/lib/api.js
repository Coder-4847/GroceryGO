/**
 * API client for the GroceryGO scraping backend.
 *
 * In dev: calls "/api/*" which Vite proxies to the local backend (see vite.config).
 * In prod (GitHub Pages): set VITE_API_BASE to the deployed backend URL, e.g.
 *   VITE_API_BASE=https://grocerygo-api.onrender.com
 */
const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function getJson(path, { signal } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Could not reach the GroceryGO server. Is the backend running?', 0)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status)
  }
  return body
}

/**
 * @param {string} item
 * @param {{ signal?: AbortSignal, fresh?: boolean }} [opts]
 * @returns {Promise<{ query: string, results: RetailerCard[], cheapest: string|null }>}
 */
export function searchItem(item, opts = {}) {
  const params = new URLSearchParams({ item })
  if (opts.fresh) params.set('fresh', '1')
  return getJson(`/search?${params.toString()}`, opts)
}

export function getRetailers(opts = {}) {
  return getJson('/retailers', opts)
}

export function getHealth(opts = {}) {
  return getJson('/health', opts)
}

/**
 * @typedef {Object} RetailerCard
 * @property {string} retailer
 * @property {string} retailerName
 * @property {string} retailerColor
 * @property {string} homepage
 * @property {'ok'|'no_results'|'unavailable'} status
 * @property {null | {
 *   name: string, brand: string|null, price: number|null,
 *   priceFormatted: string|null, currency: string, image: string|null,
 *   url: string|null, unit: string|null
 * }} product
 * @property {string|null} message
 * @property {boolean} cached
 * @property {string} fetchedAt
 */
