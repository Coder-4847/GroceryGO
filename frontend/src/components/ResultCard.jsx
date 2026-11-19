import { motion } from 'framer-motion'
import RetailerLogo from './RetailerLogo.jsx'
import { aed, relativeTime } from '../lib/format.js'

const STATUS_COPY = {
  no_results: 'Not found at this retailer.',
  unavailable: "Couldn't be checked in the latest update.",
}

export default function ResultCard({ card, isCheapest, rank }) {
  const { status, product } = card
  const ok = status === 'ok' && product

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: Math.min(rank * 0.04, 0.2) }}
      className={[
        'result-card',
        ok ? 'is-ok' : `is-${status}`,
        isCheapest ? 'is-cheapest' : '',
      ].join(' ')}
    >
      <header className="result-card-head">
        <RetailerLogo retailer={card.retailer} retailerName={card.retailerName} />
        {isCheapest && (
          <motion.span
            className="cheapest-badge"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          >
            ★ Cheapest
          </motion.span>
        )}
        {ok && card.cached && <span className="cached-tag" title="From cache">cached</span>}
        {ok && card.stale && (
          <span className="cached-tag" title="This retailer couldn't be checked in the latest update, so this is the last price we saw">
            older price
          </span>
        )}
      </header>

      {ok ? (
        <>
          <div className="result-card-body">
            {product.image ? (
              <img
                className="result-thumb"
                src={product.image}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="result-thumb result-thumb--empty" aria-hidden="true">
                🛍️
              </div>
            )}
            <div className="result-info">
              <p className="result-name" title={product.name}>
                {product.name}
              </p>
              {product.unit && <p className="result-unit">{product.unit}</p>}
              {card.fetchedAt && (
                <p className="result-asof">Checked {relativeTime(Date.parse(card.fetchedAt))}</p>
              )}
            </div>
          </div>

          <footer className="result-card-foot">
            <div className="result-price">
              <span className="result-price-value">{aed(product.price)}</span>
            </div>
            <a
              className="visit-btn"
              href={product.url || card.homepage}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit site ↗
            </a>
          </footer>
        </>
      ) : (
        <div className="result-card-empty">
          <p>{STATUS_COPY[status] || 'Unavailable right now.'}</p>
          <a className="visit-btn visit-btn--ghost" href={card.homepage} target="_blank" rel="noopener noreferrer">
            Open {card.retailerName} ↗
          </a>
        </div>
      )}
    </motion.article>
  )
}
