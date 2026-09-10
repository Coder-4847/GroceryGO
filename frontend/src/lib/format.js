export function aed(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return `AED ${Number(value).toFixed(2)}`
}

export function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}
