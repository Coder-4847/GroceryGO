import { AnimatePresence, motion } from 'framer-motion'
import ResultCard from './ResultCard.jsx'
import { aed, relativeTime } from '../lib/format.js'

export default function ResultsGrid({ payload, query, onAddToBasket, inBasket, onPickItem }) {
  if (payload?.notFound) {
    return (
      <section className="results" aria-live="polite">
        <div className="results-summary">
          <h2>
            We don&rsquo;t track <span className="results-query">&ldquo;{payload.query}&rdquo;</span> yet
          </h2>
          <p className="results-lede">
            GroceryGO compares a growing list of popular groceries, household items and electronics.
            Try one of these:
          </p>
        </div>
        <AlternativeChips names={payload.alternatives} onPick={onPickItem} />
      </section>
    )
  }

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
          <p className="results-lede">No prices available for this one right now.</p>
        )}
        {payload?.partial && (
          <p className="results-note">Showing the closest match we track. Pick another below if it&rsquo;s not what you meant.</p>
        )}
        {payload?.generatedAt && (
          <p className="results-asof">Prices checked {relativeTime(Date.parse(payload.generatedAt))}</p>
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

      {payload?.alternatives?.length > 0 && (
        <div className="results-alts">
          <p className="results-alts-title">Also in this search</p>
          <AlternativeChips names={payload.alternatives} onPick={onPickItem} />
        </div>
      )}
    </section>
  )
}

function AlternativeChips({ names = [], onPick }) {
  return (
    <div className="alt-chips">
      {names.map((n) => (
        <button type="button" key={n} className="chip" onClick={() => onPick?.(n)}>
          {n}
        </button>
      ))}
    </div>
  )
}
