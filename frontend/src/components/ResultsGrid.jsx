import { AnimatePresence, motion } from 'framer-motion'
import ResultCard from './ResultCard.jsx'
import { aed } from '../lib/format.js'

export default function ResultsGrid({ payload, query, onAddToBasket, inBasket }) {
  const results = payload?.results || []
  const priced = results.filter((r) => r.status === 'ok' && r.product?.price != null)
  const cheapestCard = priced.length
    ? priced.reduce((a, b) => (b.product.price < a.product.price ? b : a))
    : null

  const dearest = priced.length
    ? priced.reduce((a, b) => (b.product.price > a.product.price ? b : a))
    : null
  const spread =
    cheapestCard && dearest && dearest !== cheapestCard
      ? dearest.product.price - cheapestCard.product.price
      : 0

  return (
    <section className="results" aria-live="polite">
      <div className="results-summary">
        <h2>
          Results for <span className="results-query">“{query}”</span>
        </h2>
        {cheapestCard ? (
          <p className="results-lede">
            Cheapest at <strong>{cheapestCard.retailerName}</strong> — {aed(cheapestCard.product.price)}
            {spread > 0 && (
              <>
                {' '}
                <span className="results-spread">save up to {aed(spread)} vs the priciest</span>
              </>
            )}
          </p>
        ) : (
          <p className="results-lede">No live prices came back for this one.</p>
        )}
      </div>

      <motion.div layout className="results-grid">
        <AnimatePresence mode="popLayout">
          {results.map((card, i) => (
            <ResultCard
              key={card.retailer}
              card={card}
              rank={i}
              isCheapest={cheapestCard?.retailer === card.retailer}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {priced.length > 0 && (
        <motion.div layout className="results-actions">
          <button
            className={`add-basket-btn ${inBasket ? 'is-added' : ''}`}
            onClick={() => onAddToBasket(query, payload)}
            disabled={inBasket}
          >
            {inBasket ? '✓ In your basket' : '+ Add to basket'}
          </button>
        </motion.div>
      )}
    </section>
  )
}
