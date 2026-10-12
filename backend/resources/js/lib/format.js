const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 })

export const money = (v) => peso.format(Number(v || 0))

export const date = (v) => (v ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

export const dateTime = (v) =>
  v ? new Date(v).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export const humanize = (s = '') => s.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())

export const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

export function timeAgo(v) {
  const s = Math.floor((Date.now() - new Date(v)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
