import { Link, useParams } from 'react-router-dom'
import FulfilmentActions from '../../components/FulfilmentActions'
import ShipmentTimeline from '../../components/ShipmentTimeline'
import { Alert, PageLoader, StatusBadge } from '../../components/ui'
import { PageHeader } from '../../layouts/DashboardLayout'
import { dateTime, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

export default function SellerOrderDetail() {
  const { id } = useParams()
  const { data: so, loading, error, setData } = useFetch(`/seller/orders/${id}`)

  if (loading) return <PageLoader />
  if (error) return <Alert>{error}</Alert>
  const addr = so.order.shipping_address

  return (
    <>
      <Link to="/seller/orders" className="text-sm text-ink-mute hover:text-ink">Orders</Link>
      <PageHeader title={so.reference} description={`Placed ${dateTime(so.order.placed_at)} by ${so.order.customer?.name}`}
        actions={<FulfilmentActions sellerOrder={so} endpoint={`/seller/orders/${so.id}/status`} onUpdated={setData} />} />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Progress</h2><StatusBadge status={so.status} /></div>
            <ShipmentTimeline sellerOrder={so} />
          </section>
          <section className="card overflow-hidden">
            <h2 className="p-5 pb-2 text-lg font-bold">Items</h2>
            <ul className="divide-y divide-line">
              {so.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-paper">{i.product_image_url && <img src={i.product_image_url} alt="" className="size-full object-cover" />}</div>
                  <div className="min-w-0 flex-1"><div className="font-medium">{i.product_name}</div><div className="text-sm text-ink-mute">{i.product_sku} · {i.quantity} × {money(i.unit_price)}</div></div>
                  <div className="font-semibold tabular-nums">{money(i.line_total)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 text-lg font-bold">Ship to</h2>
            <p className="text-ink-soft">{addr.recipient_name}<br />{addr.phone}<br />{addr.line1}{addr.line2 && `, ${addr.line2}`}{addr.barangay && `, ${addr.barangay}`}<br />{addr.city}, {addr.province} {addr.postal_code}</p>
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-3 text-lg font-bold">Earnings</h2>
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-ink-soft">Items</dt><dd className="tabular-nums">{money(so.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Shipping fee</dt><dd className="tabular-nums">{money(so.shipping_fee)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Commission ({Number(so.commission_rate)}%)</dt><dd className="tabular-nums text-coral">−{money(so.commission_amount)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>You receive</dt><dd className="tabular-nums">{money(so.seller_earnings)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-ink-mute">Collect {money(Number(so.subtotal) + Number(so.shipping_fee))} cash on delivery. Earnings become payable once delivered.</p>
          </section>
        </div>
      </div>
    </>
  )
}
