import { Link } from 'react-router-dom'

export function SphereMark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="28" fill="#4F3BD9" />
      <ellipse cx="32" cy="32" rx="28" ry="10" fill="none" stroke="#FFB020" strokeWidth="5" transform="rotate(-20 32 32)" />
      <circle cx="32" cy="32" r="9" fill="#F7F8FC" />
    </svg>
  )
}

export default function Logo({ to = '/', suffix }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="ShopSphere home">
      <SphereMark />
      <span className="font-display text-xl font-extrabold tracking-tight">ShopSphere</span>
      {suffix && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink-soft">{suffix}</span>}
    </Link>
  )
}
