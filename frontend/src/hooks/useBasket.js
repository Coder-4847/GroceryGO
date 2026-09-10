import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'grocerygo.basket.v1'

/**
 * A basket line = one grocery item the user searched, plus the full set of
 * retailer results captured at add-time and the chosen "pick" per line
 * (defaults to the cheapest available). Persisted to localStorage.
 *
 * line = {
 *   id, query, addedAt,
 *   options: [{ retailer, retailerName, price, url, name, image }],  // priced only
 *   pickedRetailer: string | null
 * }
 */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.id && Array.isArray(l.options)) : []
  } catch {
    return []
  }
}

export function useBasket() {
  const [lines, setLines] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* private mode / quota — basket just won't persist */
    }
  }, [lines])

  // keep multiple tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setLines(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const has = useCallback((query) => lines.some((l) => l.query === query.trim().toLowerCase()), [lines])

  const addFromResults = useCallback((query, payload) => {
    const q = query.trim().toLowerCase()
    const options = (payload.results || [])
      .filter((r) => r.status === 'ok' && r.product?.price != null)
      .map((r) => ({
        retailer: r.retailer,
        retailerName: r.retailerName,
        retailerColor: r.retailerColor,
        price: r.product.price,
        priceFormatted: r.product.priceFormatted,
        name: r.product.name,
        url: r.product.url,
        image: r.product.image,
      }))
      .sort((a, b) => a.price - b.price)

    if (!options.length) return false

    setLines((prev) => {
      const without = prev.filter((l) => l.query !== q)
      return [
        ...without,
        {
          id: `${q}-${Date.now()}`,
          query: q,
          addedAt: Date.now(),
          options,
          pickedRetailer: options[0].retailer, // cheapest by default
        },
      ]
    })
    return true
  }, [])

  const remove = useCallback((id) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const setPick = useCallback((id, retailer) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, pickedRetailer: retailer } : l))
    )
  }, [])

  const summary = useMemo(() => {
    let pickedTotal = 0
    let cheapestTotal = 0
    const perRetailerCheapest = {}

    for (const line of lines) {
      const picked =
        line.options.find((o) => o.retailer === line.pickedRetailer) || line.options[0]
      if (picked) pickedTotal += picked.price
      const cheapest = line.options[0]
      if (cheapest) cheapestTotal += cheapest.price
    }

    // "if you bought everything at retailer X" — only counts lines X can fulfil
    for (const line of lines) {
      for (const o of line.options) {
        perRetailerCheapest[o.retailer] = perRetailerCheapest[o.retailer] || {
          retailer: o.retailer,
          retailerName: o.retailerName,
          total: 0,
          covered: 0,
        }
        perRetailerCheapest[o.retailer].total += o.price
        perRetailerCheapest[o.retailer].covered += 1
      }
    }

    const singleStore = Object.values(perRetailerCheapest)
      .filter((s) => s.covered === lines.length && lines.length > 0)
      .sort((a, b) => a.total - b.total)[0] || null

    return {
      count: lines.length,
      pickedTotal: round(pickedTotal),
      cheapestTotal: round(cheapestTotal),
      savingsVsPicked: round(pickedTotal - cheapestTotal),
      singleStore: singleStore
        ? { ...singleStore, total: round(singleStore.total) }
        : null,
    }
  }, [lines])

  return { lines, has, addFromResults, remove, clear, setPick, summary }
}

function round(n) {
  return Math.round(n * 100) / 100
}
