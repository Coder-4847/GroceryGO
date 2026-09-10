import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './App.css'
import SearchBar from './components/SearchBar.jsx'
import ResultsGrid from './components/ResultsGrid.jsx'
import BasketDrawer from './components/BasketDrawer.jsx'
import { useSearch } from './hooks/useSearch.js'
import { useBasket } from './hooks/useBasket.js'

const RETAILERS = ['Carrefour', 'Lulu', 'Noon', 'Amazon.ae']

export default function App() {
  const search = useSearch()
  const basket = useBasket()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // reflect the current query in the URL so searches are shareable / reloadable
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) search.run(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSearch = (q) => {
    search.run(q)
    const url = new URL(window.location.href)
    url.searchParams.set('q', q)
    window.history.replaceState({}, '', url)
  }

  const showResults = search.status === 'done' && search.data
  const showLoadingSkeleton = search.status === 'loading' && !search.data

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <a className="brand" href="./" onClick={(e) => { e.preventDefault(); search.reset(); history.replaceState({}, '', './') }}>
            <span className="brand-mark" aria-hidden="true">🛒</span>
            <span className="brand-name">GroceryGO</span>
          </a>
          <button
            className="basket-toggle"
            onClick={() => setDrawerOpen(true)}
            aria-label={`Open basket, ${basket.summary.count} item${basket.summary.count === 1 ? '' : 's'}`}
          >
            <BasketIcon />
            <AnimatePresence>
              {basket.summary.count > 0 && (
                <motion.span
                  key={basket.summary.count}
                  className="basket-count"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                >
                  {basket.summary.count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      <main className="main">
        <section className={`hero ${showResults || showLoadingSkeleton ? 'hero--compact' : ''}`}>
          {!showResults && !showLoadingSkeleton && (
            <div className="hero-copy">
              <h1>One search. Every price.</h1>
              <p>
                Compare grocery &amp; household prices across {RETAILERS.join(', ')} in the UAE —
                and see the cheapest option at a glance.
              </p>
            </div>
          )}
          <SearchBar onSearch={onSearch} loading={search.status === 'loading'} initialValue={search.query} />
        </section>

        {search.status === 'error' && (
          <div className="notice notice--error">
            <p>{search.error}</p>
            <button className="chip" onClick={() => search.run(search.query, { fresh: true })}>
              Retry
            </button>
          </div>
        )}

        {showLoadingSkeleton && <LoadingSkeleton query={search.query} />}

        <AnimatePresence mode="wait">
          {showResults && (
            <motion.div
              key={search.data.query}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ResultsGrid
                payload={search.data}
                query={search.data.query}
                onAddToBasket={(q, payload) => basket.addFromResults(q, payload)}
                inBasket={basket.has(search.data.query)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="site-foot">
        <p>
          GroceryGO compares publicly listed prices. Prices update roughly every 20 minutes and may
          differ at checkout. Not affiliated with any retailer.
        </p>
      </footer>

      <BasketDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} basket={basket} />
    </div>
  )
}

function LoadingSkeleton({ query }) {
  // The free-tier backend sleeps when idle; the first search after a while waits
  // for it (and a browser) to spin up. Let the user know if it's taking a while.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 7000)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="results">
      <div className="results-summary">
        <h2>
          Searching <span className="results-query">“{query}”</span>…
        </h2>
        <p className="results-lede">
          {slow
            ? 'The backend may be waking up — the first search can take up to a minute.'
            : 'Checking Carrefour, Lulu, Noon and Amazon.ae.'}
        </p>
      </div>
      <div className="results-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="result-card is-skeleton" key={i}>
            <div className="sk sk-logo" />
            <div className="sk sk-line" />
            <div className="sk sk-line sk-line--short" />
            <div className="sk sk-foot" />
          </div>
        ))}
      </div>
    </section>
  )
}

function BasketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 8h12l-1.2 9.2A2 2 0 0 1 14.82 19H9.18a2 2 0 0 1-1.98-1.8L6 8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
