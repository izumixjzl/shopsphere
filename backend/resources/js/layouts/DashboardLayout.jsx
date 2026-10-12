import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import Logo from '../components/Logo'
import NotificationBell from '../components/NotificationBell'
import { useAuth } from '../context/AuthContext'

/** Shared shell for the seller and admin dashboards. `nav` = [[to, label, Icon, end?]] */
export default function DashboardLayout({ nav, area, banner }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  const sidebar = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label={`${area} navigation`}>
      {nav.map(([to, label, Icon, end]) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
          <Icon className="size-[18px]" /> {label}
        </NavLink>
      ))}
      <div className="mt-auto space-y-0.5 border-t border-white/10 pb-4 pt-3">
        <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"><ExternalLink className="size-[18px]" /> View storefront</NavLink>
        <button onClick={async () => { await logout(); navigate('/login') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white">
          <LogOut className="size-[18px]" /> Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink lg:flex">
        <div className="px-6 py-5 text-white [&_a]:text-white"><Logo to={area === 'Admin' ? '/admin' : '/seller'} /></div>
        <div className="mx-6 mb-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">{area} workspace</div>
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/50 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-ink">
            <div className="flex items-center justify-between px-6 py-5 text-white">
              <span className="font-display text-xl font-extrabold">ShopSphere</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
          <span className="font-display text-lg font-bold lg:hidden">{area}</span>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="flex items-center gap-2 pl-1">
              <span className="grid size-8 place-items-center rounded-full bg-sphere text-sm font-bold text-white">{user?.name?.[0]}</span>
              <div className="hidden text-sm leading-tight sm:block">
                <div className="font-semibold">{user?.seller_profile?.store_name || user?.name}</div>
                <div className="text-xs text-ink-mute">{user?.email}</div>
              </div>
            </div>
          </div>
        </header>
        {banner}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
      </div>
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
