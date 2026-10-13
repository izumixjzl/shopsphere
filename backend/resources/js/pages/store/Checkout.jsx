import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Banknote, Check, CreditCard, MapPin } from 'lucide-react'
import AddressForm from '../../components/AddressForm'
import { Alert, Button, PageLoader, Textarea } from '../../components/ui'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

// randomUUID needs a secure context (https or localhost); fall back for plain-http LAN testing.
const newCheckoutKey = () => globalThis.crypto?.randomUUID?.()
  ?? `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

export default function Checkout() {
  const { cart, refresh } = useCart()
  const addresses = useFetch('/addresses')
  const [addressId, setAddressId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)
  const methods = useFetch('/checkout/payment-methods')
  const [method, setMethod] = useState('cod')
  // One key per checkout visit: if "Place order" is retried after a timeout, the server
  // returns the order it already made instead of creating a second one.
  const checkoutKey = useRef(newCheckoutKey())
  const placed = useRef(false)
  const navigate = useNavigate()
  const toast = useToast()

  const list = addresses.data?.data ?? []
  const online = methods.data?.data.find((m) => m.code === method)?.online
  useEffect(() => {
    if (!addressId && list.length) setAddressId((list.find((a) => a.is_default) || list[0]).id)
  }, [list, addressId])

  if (placed.current || !cart || addresses.loading) return <PageLoader />
  // Only for arriving here with nothing to buy; after placing an order the cart is empty on purpose.
  if (cart.groups.length === 0) return <Navigate to="/cart" replace />

  async function placeOrder() {
    setPlacing(true); setError(null)
    try {
      const { data } = await api.post('/orders',
        // expected_total: the server refuses the order if prices changed since this page loaded.
        { address_id: addressId, payment_method: method, notes: notes || null, expected_total: cart.grand_total },
        { headers: { 'Idempotency-Key': checkoutKey.current } })
      placed.current = true
      const payUrl = data.payments?.find((p) => p.status === 'pending')?.checkout_url
      if (payUrl) {
        navigate(payUrl, { replace: true })
      } else {
        toast('Order placed')
        navigate(`/account/orders/${data.id}`, { replace: true, state: { justPlaced: data.payment_method === 'cod' } })
      }
      // Leave first, then empty the header cart badge; refreshing earlier bounced us to /cart.
      refresh().catch(() => {})
    } catch (e) {
      setError(Object.values(fieldErrors(e))[0] || errorMessage(e))
      refresh()
    } finally { setPlacing(false) }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><MapPin className="size-5 text-sphere" /> Delivery address</h2>
            {list.length > 0 && !adding && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {list.map((a) => (
                  <button key={a.id} onClick={() => setAddressId(a.id)} aria-pressed={addressId === a.id}
                    className={`relative rounded-xl border-2 p-4 text-left text-sm transition-colors ${addressId === a.id ? 'border-sphere bg-sphere-tint/40' : 'border-line hover:border-ink-mute'}`}>
                    {addressId === a.id && <Check className="absolute right-3 top-3 size-4 text-sphere" />}
                    <div className="font-semibold">{a.recipient_name} <span className="font-normal text-ink-mute">· {a.label}</span></div>
                    <div className="mt-1 text-ink-soft">{a.line1}{a.barangay && `, ${a.barangay}`}<br />{a.city}, {a.province} {a.postal_code}</div>
                    <div className="mt-1 text-ink-mute">{a.phone}</div>
                  </button>
                ))}
              </div>
            )}
            {(adding || list.length === 0) ? (
              <div className="mt-4">
                <AddressForm onCancel={list.length ? () => setAdding(false) : undefined}
                  onSaved={(a) => { addresses.reload(); setAddressId(a.id); setAdding(false) }} />
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setAdding(true)}>Add a new address</Button>
            )}
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Banknote className="size-5 text-sphere" /> Payment</h2>
            <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Payment method">
              {(methods.data?.data ?? [{ code: 'cod', label: 'Cash on delivery', description: 'Pay each courier when your parcel from that store arrives.' }]).map((m) => (
                <button key={m.code} type="button" role="radio" aria-checked={method === m.code} onClick={() => setMethod(m.code)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${method === m.code ? 'border-sphere bg-sphere-tint/40' : 'border-line hover:border-ink-mute'}`}>
                  {method === m.code ? <Check className="mt-0.5 size-4 shrink-0 text-sphere" /> : m.online ? <CreditCard className="mt-0.5 size-4 shrink-0 text-ink-mute" /> : <Banknote className="mt-0.5 size-4 shrink-0 text-ink-mute" />}
                  <div className="text-sm"><div className="font-semibold">{m.label}</div><div className="text-ink-soft">{m.description}</div></div>
                </button>
              ))}
            </div>
            <Textarea className="mt-5" label="Note for sellers (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Landmarks, preferred delivery time…" />
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-36">
          <h2 className="text-xl font-bold">Your order</h2>
          <ul className="mt-4 space-y-4">
            {cart.groups.map((g) => (
              <li key={g.seller_id}>
                <div className="text-sm font-semibold">{g.store_name}</div>
                <ul className="mt-1 space-y-1 text-sm text-ink-soft">
                  {g.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.quantity} × {i.product?.name}</span><span className="tabular-nums">{money(i.line_total)}</span></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular-nums">{money(cart.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd className="tabular-nums">{money(cart.shipping_total)}</dd></div>
            <div className="flex justify-between pt-2 text-base font-semibold"><dt>{online ? 'Pay now' : 'Pay on delivery'}</dt><dd className="font-display text-2xl tabular-nums">{money(cart.grand_total)}</dd></div>
          </dl>
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          <Button size="lg" className="mt-5 w-full" loading={placing} disabled={!addressId || !cart.can_checkout} onClick={placeOrder}>{online ? 'Continue to payment' : 'Place order'}</Button>
          <p className="mt-3 text-center text-xs text-ink-mute">Your order is split into {cart.groups.length} {cart.groups.length === 1 ? 'shipment' : 'shipments'}, one per store.</p>
        </aside>
      </div>
    </div>
  )
}
