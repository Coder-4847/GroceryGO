/**
 * Static catalog mode (GitHub Pages).
 *
 * A scheduled GitHub Actions job scrapes the retailers and publishes
 * `data/prices.json` next to the site. Searching is done entirely in the
 * browser against that file, so it works on any device with no backend.
 */
import { ApiError } from './api-error.js'

export const isStatic = import.meta.env.VITE_STATIC === '1'

const DATA_URL = `${import.meta.env.BASE_URL}data/prices.json`

let catalogPromise = null

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(DATA_URL, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(index)
      .catch((err) => {
        catalogPromise = null // allow a retry
        throw new ApiError(`Couldn't load the latest prices (${err.message}). Please refresh.`, 0)
      })
  }
  return catalogPromise
}

// ---- indexing ------------------------------------------------------------

const stem = (t) => (t.length > 3 ? t.replace(/(ies)$/, 'y').replace(/(es|s)$/, '') : t)
const tokenize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)

function index(data) {
  const retailerById = Object.fromEntries(data.retailers.map((r, i) => [r.id, { ...r, order: i }]))
  const items = data.items.map((it) => {
    const nameTokens = tokenize(it.name)
    const extra = tokenize([it.category, ...(it.aliases || [])].join(' '))
    return {
      ...it,
      nameLower: it.name.toLowerCase(),
      aliasLower: (it.aliases || []).map((a) => a.toLowerCase()),
      stems: new Set([...nameTokens, ...extra].map(stem)),
    }
  })
  return { ...data, retailerById, items }
}

// ---- searching -----------------------------------------------------------

function scoreItem(item, phrase, qStems) {
  let matched = 0
  for (const q of qStems) {
    let hit = false
    for (const s of item.stems) {
      if (s === q || s.startsWith(q) || (q.length >= 4 && s.includes(q))) {
        hit = true
        break
      }
    }
    if (hit) matched++
  }
  if (!matched) return null
  let score = matched * 10
  if (item.nameLower.includes(phrase)) score += 15
  if (item.aliasLower.includes(phrase)) score += 12
  if (item.nameLower === phrase) score += 30
  return { item, matched, score: score - item.rank * 0.01, all: matched === qStems.length }
}

export function findItems(catalog, query) {
  const phrase = String(query || '').toLowerCase().trim()
  const qStems = tokenize(phrase).map(stem)
  if (!qStems.length) return { hits: [], partial: false }
  const scored = catalog.items.map((it) => scoreItem(it, phrase, qStems)).filter(Boolean)
  const strict = scored.filter((s) => s.all).sort((a, b) => b.score - a.score)
  if (strict.length) return { hits: strict.map((s) => s.item), partial: false }
  return { hits: scored.sort((a, b) => b.score - a.score).map((s) => s.item), partial: true }
}

/** Autocomplete: item names matching what is typed so far. */
export function suggestItems(catalog, query, limit = 6) {
  if (!catalog || String(query || '').trim().length < 2) return []
  const { hits, partial } = findItems(catalog, query)
  return partial ? [] : hits.slice(0, limit).map((i) => i.name)
}

function toCard(catalog, retailerId, c) {
  const r = catalog.retailerById[retailerId]
  return {
    retailer: r.id,
    retailerName: r.name,
    retailerColor: r.color,
    homepage: r.homepage,
    status: c.status,
    product: c.product || null,
    message: c.message || null,
    cached: false,
    stale: !!c.stale,
    fetchedAt: c.fetchedAt,
  }
}

function buildPayload(catalog, item, { alternatives = [], partial = false } = {}) {
  const rank = (c) => (c.status === 'ok' ? 0 : c.status === 'no_results' ? 1 : 2)
  const results = Object.entries(item.cards)
    .map(([id, c]) => toCard(catalog, id, c))
    .sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      if (a.status === 'ok' && b.status === 'ok') return a.product.price - b.product.price
      return catalog.retailerById[a.retailer].order - catalog.retailerById[b.retailer].order
    })
  const priced = results.filter((c) => c.status === 'ok' && c.product?.price != null)
  const cheapest = priced.length
    ? priced.reduce((m, c) => (c.product.price < m.product.price ? c : m)).retailer
    : null
  return {
    query: item.name,
    results,
    cheapest,
    generatedAt: catalog.generatedAt,
    category: item.category,
    partial,
    alternatives: alternatives.map((i) => i.name),
  }
}

export async function searchCatalog(query) {
  const catalog = await loadCatalog()
  const { hits, partial } = findItems(catalog, query)
  if (!hits.length) {
    const popular = [...catalog.items].sort((a, b) => a.rank - b.rank).slice(0, 8)
    return {
      query,
      results: [],
      cheapest: null,
      generatedAt: catalog.generatedAt,
      notFound: true,
      alternatives: popular.map((i) => i.name),
    }
  }
  const [top, ...rest] = hits
  return buildPayload(catalog, top, { alternatives: rest.slice(0, 8), partial })
}
