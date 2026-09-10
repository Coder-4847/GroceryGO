/**
 * Text-mark "logos" — we don't ship the retailers' actual trademarks. Each is a
 * coloured wordmark chip keyed to the retailer's brand colour.
 */
const MARKS = {
  carrefour: { label: 'Carrefour', bg: '#004E9F', fg: '#ffffff' },
  lulu: { label: 'LuLu', bg: '#00A54F', fg: '#ffffff' },
  noon: { label: 'noon', bg: '#FEEE00', fg: '#1a1a1a' },
  amazon: { label: 'amazon.ae', bg: '#232F3E', fg: '#FF9900' },
}

export default function RetailerLogo({ retailer, retailerName }) {
  const mark = MARKS[retailer] || { label: retailerName || retailer, bg: '#444', fg: '#fff' }
  return (
    <span className="retailer-logo" style={{ background: mark.bg, color: mark.fg }}>
      {mark.label}
    </span>
  )
}
