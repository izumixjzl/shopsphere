import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CreditCard, FlaskConical } from 'lucide-react'
import { Alert, Button, EmptyState, PageLoader } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { api, errorMessage } from '../../lib/api'
import { dateTime, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

/**
 * Stand-in for a payment provider's hosted checkout page (sandbox gateway only).
 * The buttons make the server send itself a signed webhook, so the order is updated
 * through exactly the same path a real provider would use.
 */
export default function SandboxPay() {
  const { reference } = useParams()
  const { data, loading, error } = useFetch(`/sandbox/payments/${reference}`)
  const [busy, setBusy] = useState(null)
  const [failure, setFailure] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()

  if (loading) return <PageLoader />
  if (error) return <EmptyState icon={CreditCard} title="Payment not found" action={<Button to="/account/orders">My orders</Button>}>This payment link is invalid or has been closed.</EmptyState>

  const p = data.data

  async function finish(outcome) {
    setBusy(outcome); setFailure(null)
    try {
      const { data: res } = await api.post(`/sandbox/payments/${reference}/complete`, { outcome })
      toast(res.data.status === 'paid' ? 'Payment received' : 'Payment failed')
      navigate(`/account/orders/${res.data.order_id}`, { replace: true, state: { justPlaced: res.data.status === 'paid' } })
    } catch (e) { setFailure(errorMessage(e)) } finally { setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 bg-mango-tint px-5 py-3 text-sm font-semibold text-[#8a5a00]">
          <FlaskConical className="size-4" /> Sandbox payment · no real money is charged
        </div>
        <div className="p-6">
          <p className="text-sm text-ink-mute">Order {p.order.order_number}</p>
          <div className="mt-1 font-display text-4xl font-extrabold">{money(p.amount)}</div>
          <p className="mt-1 font-mono text-xs text-ink-mute">{p.reference}</p>
          {p.expires_at && <p className="mt-3 text-sm text-ink-soft">Complete payment before {dateTime(p.expires_at)}.</p>}

          {p.status === 'pending' ? (
            <div className="mt-6 grid gap-2">
              <Button size="lg" loading={busy === 'paid'} disabled={Boolean(busy)} onClick={() => finish('paid')}><CreditCard className="size-4" /> Pay {money(p.amount)}</Button>
              <Button variant="ghost" loading={busy === 'failed'} disabled={Boolean(busy)} onClick={() => finish('failed')}>Simulate a declined payment</Button>
            </div>
          ) : (
            <div className="mt-6"><Alert tone="info">This payment is already {p.status}.</Alert>
              <Button className="mt-4 w-full" variant="outline" to={`/account/orders/${p.order.id}`}>Back to order</Button></div>
          )}
          {failure && <div className="mt-4"><Alert>{failure}</Alert></div>}
        </div>
      </div>
    </div>
  )
}
