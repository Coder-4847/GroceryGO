import { AnimatePresence, motion } from 'framer-motion'
import { aed, relativeTime } from '../lib/format.js'

export default function BasketDrawer({ open, onClose, basket }) {
  const { lines, remove, clear, setPick, summary } = basket

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-label="Your basket"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header className="drawer-head">
              <h2>Your basket</h2>
              <button className="drawer-close" onClick={onClose} aria-label="Close basket">
                ✕
              </button>
            </header>

            {lines.length === 0 ? (
              <div className="drawer-empty">
                <p>Your basket is empty.</p>
                <p className="drawer-empty-hint">
                  Search an item, then hit <em>Add to basket</em> to start a price-compared list.
                </p>
              </div>
            ) : (
              <>
                <ul className="drawer-list">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => {
                      const picked =
                        line.options.find((o) => o.retailer === line.pickedRetailer) ||
                        line.options[0]
                      const cheapest = line.options[0]
                      return (
                        <motion.li
                          key={line.id}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.25 }}
                          className="drawer-line"
                        >
                          <div className="drawer-line-top">
                            <div>
                              <p className="drawer-line-query">{line.query}</p>
                              <p className="drawer-line-meta">
                                {line.options.length} store
                                {line.options.length > 1 ? 's' : ''} · added {relativeTime(line.addedAt)}
                              </p>
                            </div>
                            <button
                              className="drawer-line-remove"
                              onClick={() => remove(line.id)}
                              aria-label={`Remove ${line.query}`}
                            >
                              Remove
                            </button>
                          </div>

                          <div className="drawer-line-options">
                            {line.options.map((o) => (
                              <button
                                key={o.retailer}
                                className={`opt ${o.retailer === picked.retailer ? 'is-picked' : ''} ${
                                  o.retailer === cheapest.retailer ? 'is-cheapest' : ''
                                }`}
                                onClick={() => setPick(line.id, o.retailer)}
                                title={o.name}
                              >
                                <span className="opt-store">{o.retailerName}</span>
                                <span className="opt-price">{aed(o.price)}</span>
                              </button>
                            ))}
                          </div>

                          <a
                            className="drawer-line-visit"
                            href={picked.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open pick at {picked.retailerName} ↗
                          </a>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>

                <div className="drawer-summary">
                  <div className="drawer-summary-row">
                    <span>Your picks</span>
                    <strong>{aed(summary.pickedTotal)}</strong>
                  </div>
                  <div className="drawer-summary-row is-highlight">
                    <span>Cheapest per item</span>
                    <strong>{aed(summary.cheapestTotal)}</strong>
                  </div>
                  {summary.savingsVsPicked > 0 && (
                    <p className="drawer-summary-note">
                      Switching every line to its cheapest store saves{' '}
                      <strong>{aed(summary.savingsVsPicked)}</strong>.
                    </p>
                  )}
                  {summary.singleStore && (
                    <p className="drawer-summary-note">
                      Whole list at one store: <strong>{summary.singleStore.retailerName}</strong> for{' '}
                      {aed(summary.singleStore.total)}.
                    </p>
                  )}
                  <button className="drawer-clear" onClick={clear}>
                    Clear basket
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
