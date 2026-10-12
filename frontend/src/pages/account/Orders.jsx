import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { Button, EmptyState, Pagination, Skeleton, StatusBadge } from '../../components/ui'
import { date, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

const TABS = [['', 'All'], ['pending', 'Pending'], ['processing', 'Processing'], ['shipped', 'Shipped'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]

export default function Orders() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading } = useFetch('/orders', { status: status || undefined, page })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">My orders</h1>
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1) }}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${status === v ? 'border-sphere text-sphere' : 'border-transparent text-ink-soft hover:text-ink'}`}>{l}</button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        {!loading && data?.data.length === 0 && (
          <EmptyState icon={Package} title="No orders here yet" action={<Button to="/shop">Start shopping</Button>}>When you place an order, you can track each store's shipment here.</EmptyState>
        )}
        {!loading && data?.data.map((o) => (
          <Link key={o.id} to={`/account/orders/${o.id}`} className="card block p-5 hover:border-ink-mute">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Order {o.order_number}</div>
                <div className="text-sm text-ink-mute">Placed {date(o.placed_at)} · {o.seller_orders.length} {o.seller_orders.length === 1 ? 'store' : 'stores'}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={o.status} />
                <span className="font-display text-lg font-bold tabular-nums">{money(o.grand_total)}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-hidden">
              {o.seller_orders.flatMap((so) => so.items).slice(0, 6).map((i) => (
                <div key={i.id} className="size-14 shrink-0 overflow-hidden rounded-lg bg-paper">
                  {i.product_image_url && <img src={i.product_image_url} alt={i.product_name} className="size-full object-cover" />}
                </div>
              ))}
            </div>
          </Link>
        ))}
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
    </div>
  )
}
