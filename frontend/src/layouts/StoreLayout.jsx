import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, LayoutDashboard, LogOut, Package, Search, ShoppingBag, User } from 'lucide-react'
import Logo from '../components/Logo'
import NotificationBell from '../components/NotificationBell'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFetch } from '../lib/useFetch'

function SearchBox({ className = '' }) {
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const navigate = useNavigate()
  return (
    <form role="search" className={`relative ${className}`}
      onSubmit={(e) => { e.preventDefault(); navigate(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`) }}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands, stores"
        aria-label="Search products" className="field rounded-full bg-paper pl-10" />
    </form>
  )
}

function AccountMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const items = user.role === 'customer'
    ? [['/account/orders', 'My orders', Package], ['/account/wishlist', 'Wishlist', Heart], ['/account', 'Account & addresses', User]]
    : [[user.role === 'admin' ? '/admin' : '/seller', 'Open dashboard', LayoutDashboard]]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-ink/5">
        <span className="grid size-8 place-items-center rounded-full bg-sphere text-sm font-bold text-white">{user.name[0]}</span>
        <span className="hidden max-w-28 truncate text-sm font-medium md:block">{user.name.split(' ')[0]}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-xl shadow-ink/10">
          <div className="border-b border-line px-4 py-2.5 text-sm">
            <div className="font-semibold">{user.name}</div>
            <div className="truncate text-ink-mute">{user.email}</div>
          </div>
          {items.map(([to, label, Icon]) => (
            <Link key={to} to={to} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-paper">
              <Icon className="size-4 text-ink-mute" /> {label}
            </Link>
          ))}
          <button role="menuitem" onClick={async () => { await logout(); navigate('/') }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-paper">
            <LogOut className="size-4 text-ink-mute" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function StoreLayout() {
  const { user } = useAuth()
  const { count, enabled } = useCart()
  const { data: categories } = useFetch('/categories')
  const { pathname } = useLocation()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <SearchBox className="ml-4 hidden flex-1 md:block md:max-w-xl" />
          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <>
                <NotificationBell />
                {enabled && (
                  <Link to="/cart" className="relative grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink" aria-label={`Cart, ${count} items`}>
                    <ShoppingBag className="size-5" />
                    {count > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-4.5 place-items-center rounded-full bg-mango px-1 text-[10px] font-bold leading-4.5 text-ink">{count}</span>}
                  </Link>
                )}
                <AccountMenu />
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" to="/login">Sign in</Button>
                <Button size="sm" to="/register">Create account</Button>
              </>
            )}
          </div>
        </div>
        <SearchBox className="px-4 pb-3 md:hidden" />
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm sm:px-6" aria-label="Categories">
          <NavLink to="/shop" end className={({ isActive }) => `shrink-0 rounded-full px-3 py-1.5 font-medium ${isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5'}`}>All products</NavLink>
          {categories?.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} className="shrink-0 rounded-full px-3 py-1.5 font-medium text-ink-soft hover:bg-ink/5">{c.name}</Link>
          ))}
        </nav>
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="mt-20 bg-ink text-white/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="font-display text-2xl font-extrabold text-white">ShopSphere</div>
            <p className="mt-2 max-w-sm text-sm">Independent Filipino stores, one cart. Pay cash when your order arrives.</p>
          </div>
          <div className="text-sm">
            <div className="mb-3 font-semibold text-white">Shop</div>
            <ul className="space-y-2">
              <li><Link to="/shop" className="hover:text-white">All products</Link></li>
              <li><Link to="/shop?sort=popular" className="hover:text-white">Best sellers</Link></li>
              <li><Link to="/account/orders" className="hover:text-white">Track an order</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <div className="mb-3 font-semibold text-white">Sell</div>
            <ul className="space-y-2">
              <li><Link to="/register?role=seller" className="hover:text-white">Open a store</Link></li>
              <li><Link to="/login" className="hover:text-white">Seller sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">A portfolio project built with React, Tailwind CSS and Laravel.</div>
      </footer>
    </div>
  )
}
