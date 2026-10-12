import { Link } from 'react-router-dom'
import { AlertTriangle, Minus, Plus, ShoppingBag, Store, Trash2 } from 'lucide-react'
import { Alert, Button, EmptyState, PageLoader } from '../../components/ui'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { errorMessage, fieldErrors } from '../../lib/api'
import { money } from '../../lib/format'

export default function Cart() {
  const { cart, update, remove } = useCart()
  const toast = useToast()

  if (!cart) return <PageLoader />
  if (cart.groups.length === 0) {
    return <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Button to="/shop">Browse products</Button>}>Items you add from any store will appear here together.</EmptyState>
  }

  const run = async (fn) => {
    try { await fn() } catch (e) { toast(Object.values(fieldErrors(e))[0] || errorMessage(e), 'error') }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <p className="mt-1 text-ink-soft">{cart.item_count} items from {cart.groups.length} {cart.groups.length === 1 ? 'store' : 'stores'}. Each store ships its items separately.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {cart.groups.map((g) => (
            <section key={g.seller_id} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line bg-paper/60 px-5 py-3">
                <Link to={`/stores/${g.store_slug}`} className="flex items-center gap-2 font-semibold hover:text-sphere"><Store className="size-4" /> {g.store_name}</Link>
                <span className="text-sm text-ink-soft">{money(g.subtotal)}</span>
              </header>
              <ul className="divide-y divide-line">
                {g.items.map((item) => {
                  const p = item.product
                  const problem = !item.is_available ? 'No longer available' : !item.has_enough_stock ? `Only ${p?.stock ?? 0} left — lower the quantity` : null
                  return (
                    <li key={item.id} className="flex gap-4 p-5">
                      <Link to={`/products/${p?.slug}`} className="size-20 shrink-0 overflow-hidden rounded-xl bg-paper">
                        {p?.image_url && <img src={p.image_url} alt="" className="size-full object-cover" />}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex justify-between gap-3">
                          <Link to={`/products/${p?.slug}`} className="line-clamp-2 font-medium hover:text-sphere">{p?.name}</Link>
                          <span className="shrink-0 font-semibold tabular-nums">{money(item.line_total)}</span>
                        </div>
                        <span className="text-sm text-ink-mute">{money(p?.price)} each</span>
                        {problem && <span className="mt-1 flex items-center gap-1 text-sm text-coral"><AlertTriangle className="size-3.5" /> {problem}</span>}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex h-9 items-center rounded-full border border-line">
                            <button className="grid size-9 place-items-center disabled:opacity-30" disabled={item.quantity <= 1} onClick={() => run(() => update(item.id, item.quantity - 1))} aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
                            <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                            <button className="grid size-9 place-items-center disabled:opacity-30" disabled={item.quantity >= (p?.stock ?? 0)} onClick={() => run(() => update(item.id, item.quantity + 1))} aria-label="Increase quantity"><Plus className="size-3.5" /></button>
                          </div>
                          <button onClick={() => run(() => remove(item.id))} className="flex items-center gap-1 text-sm text-ink-mute hover:text-coral"><Trash2 className="size-4" /> Remove</button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit rounded-[var(--radius-card)] bg-ink p-6 text-white lg:sticky lg:top-36">
          <h2 className="text-xl font-bold">Order summary</h2>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-white/70">Subtotal</dt><dd className="tabular-nums">{money(cart.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/70">Shipping ({cart.groups.length} {cart.groups.length === 1 ? 'store' : 'stores'})</dt><dd className="tabular-nums">{money(cart.shipping_total)}</dd></div>
            <div className="flex justify-between border-t border-white/15 pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-display text-2xl tabular-nums">{money(cart.grand_total)}</dd></div>
          </dl>
          {!cart.can_checkout && <div className="mt-4"><Alert tone="warn">Fix the highlighted items before checking out.</Alert></div>}
          <Button to={cart.can_checkout ? '/checkout' : undefined} disabled={!cart.can_checkout} variant="mango" size="lg" className="mt-5 w-full">Go to checkout</Button>
          <p className="mt-3 text-center text-xs text-white/60">Cash on delivery. No card needed.</p>
        </aside>
      </div>
    </div>
  )
}
