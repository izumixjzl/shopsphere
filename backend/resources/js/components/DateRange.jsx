// Local calendar date (toISOString would shift to UTC).
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function defaultRange(days = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (days - 1))
  return { from: iso(from), to: iso(to) }
}

const PRESETS = [[7, '7 days'], [30, '30 days'], [90, '90 days']]

export default function DateRange({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-ink/5 p-1">
        {PRESETS.map(([d, l]) => {
          const r = defaultRange(d)
          const active = r.from === value.from && r.to === value.to
          return (
            <button key={d} onClick={() => onChange(r)} className={`rounded-full px-3 py-1 text-sm font-medium ${active ? 'bg-white shadow-sm' : 'text-ink-soft'}`}>{l}</button>
          )
        })}
      </div>
      <input type="date" className="field w-auto py-1.5 text-sm" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="From date" />
      <input type="date" className="field w-auto py-1.5 text-sm" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="To date" />
    </div>
  )
}
