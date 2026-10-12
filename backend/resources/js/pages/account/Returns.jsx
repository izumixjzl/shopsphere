import { Link } from 'react-router-dom'
import { Lock, LifeBuoy, Store } from 'lucide-react'
import Evidence from '../../components/Evidence'
import { Button, EmptyState, Skeleton, StatusBadge } from '../../components/ui'
import { dateTime, humanize, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

const STATUS_TEXT = {
  requested: 'The store is reviewing your request.',
  approved: 'Approved by the store. Your refund is being prepared.',
  rejected: 'The store did not approve this request.',
  refunded: 'Refunded.',
}

/** Customer's return / dispute requests. Read-only: requests can't be changed after they're filed. */
export default function Returns() {
  const { data, loading } = useFetch('/refunds')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">My returns</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-mute">
        <Lock className="size-3.5" /> Requests and proof can't be edited after you send them. We'll notify you when there's an update.
      </p>

      <div className="mt-6 space-y-4">
        {loading && [1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        {!loading && data?.data.length === 0 && (
          <EmptyState icon={LifeBuoy} title="No return requests" action={<Button to="/account/orders">Go to my orders</Button>}>
            To return an item or report a problem, open a delivered order and choose "Return / report".
          </EmptyState>
        )}
        {!loading && data?.data.map((r) => (
          <article key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-paper">
                  {r.order_item?.product_image_url && <img src={r.order_item.product_image_url} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{r.order_item?.product_name ?? 'Item'}</div>
                  <div className="text-sm text-ink-mute">
                    <Link to={`/account/orders/${r.order_id}`} className="hover:text-ink">Order {r.order?.order_number}</Link>
                    {r.seller_order?.seller?.seller_profile && <> · <Store className="inline size-3.5" /> {r.seller_order.seller.seller_profile.store_name}</>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={r.status} />
                <div className="mt-1 font-display text-lg font-bold tabular-nums">{money(r.amount)}</div>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-ink-mute">Request</dt><dd>{humanize(r.type)} · {r.reason}</dd>
              {r.details && <><dt className="text-ink-mute">Details</dt><dd className="whitespace-pre-line">{r.details}</dd></>}
              <dt className="text-ink-mute">Proof</dt><dd><Evidence refund={r} size="size-16" /></dd>
              <dt className="text-ink-mute">Filed</dt><dd>{dateTime(r.created_at)}</dd>
              <dt className="text-ink-mute">Status</dt>
              <dd>{STATUS_TEXT[r.status]}{r.resolution_note && <span className="mt-1 block rounded-lg bg-paper px-3 py-2 text-ink-soft">“{r.resolution_note}”</span>}</dd>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
