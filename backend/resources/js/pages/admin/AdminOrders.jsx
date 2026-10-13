import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Inbox, Search } from 'lucide-react'
import FulfilmentActions from '../../components/FulfilmentActions'
import ShipmentTimeline from '../../components/ShipmentTimeline'
import { Alert, EmptyState, PageLoader, Pagination, Select, StatusBadge, Table } from '../../components/ui'
import { PageHeader } from '../../layouts/DashboardLayout'
import { date, dateTime, money } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

export function AdminOrders() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, loading } = useFetch('/admin/orders', { status: status || undefined, q: dq || undefined, page })
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="All orders" description="Every checkout across the marketplace, with each store's part." />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-9" placeholder="Order number, customer name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="Search orders" />
          </div>
          <Select aria-label="Status" className="w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All statuses</option>
            {['pending', 'processing', 'partially_shipped', 'shipped', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
        </div>
        <Table loading={loading} rows={data?.data} onRowClick={(r) => navigate(`/admin/orders/${r.id}`)}
          empty={<EmptyState icon={Inbox} title="No orders match" />}
          columns={[
            { key: 'order_number', label: 'Order', render: (r) => <span className="font-medium">{r.order_number}</span> },
            { key: 'customer', label: 'Customer', render: (r) => <div><div>{r.customer?.name}</div><div className="text-xs text-ink-mute">{r.customer?.email}</div></div> },
            { key: 'stores', label: 'Stores', align: 'right', render: (r) => r.seller_orders_count },
            { key: 'placed_at', label: 'Placed', render: (r) => date(r.placed_at) },
            { key: 'payment_status', label: 'Payment', render: (r) => <StatusBadge status={r.payment_status} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'grand_total', label: 'Total', align: 'right', render: (r) => money(r.grand_total) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
    </>
  )
}

export function AdminOrderDetail() {
  const { id } = useParams()
  const { data: o, loading, error, setData } = useFetch(`/admin/orders/${id}`)
  if (loading) return <PageLoader />
  if (error) return <Alert>{error}</Alert>
  const a = o.shipping_address

  return (
    <>
      <Link to="/admin/orders" className="text-sm text-ink-mute hover:text-ink">All orders</Link>
      <PageHeader title={`Order ${o.order_number}`} description={`${o.customer?.name} · ${o.customer?.email} · ${dateTime(o.placed_at)}`}
        actions={<><StatusBadge status={o.status} /><StatusBadge status={o.payment_status} /></>} />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {o.seller_orders.map((so) => (
            <section key={so.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div><div className="font-semibold">{so.seller?.store_name}</div><div className="text-xs text-ink-mute">{so.reference}</div></div>
                <FulfilmentActions sellerOrder={so} endpoint={`/admin/seller-orders/${so.id}/status`} onUpdated={setData}
                  awaitingPayment={o.payment_method !== 'cod' && o.payment_status !== 'paid'}
                  paidOnline={o.payment_method !== 'cod'} />
              </header>
              <div className="px-5 py-4"><ShipmentTimeline sellerOrder={so} /></div>
              <ul className="divide-y divide-line border-t border-line text-sm">
                {so.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 px-5 py-2.5"><span>{i.quantity} × {i.product_name} <span className="text-ink-mute">({i.product_sku})</span></span><span className="tabular-nums">{money(i.line_total)}</span></li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-line bg-paper/60 px-5 py-2.5 text-xs text-ink-soft">
                <span>Items {money(so.subtotal)}</span><span>Shipping {money(so.shipping_fee)}</span>
                <span>Commission {Number(so.commission_rate)}% = {money(so.commission_amount)}</span><span className="font-semibold text-ink">Seller gets {money(so.seller_earnings)}</span>
              </div>
            </section>
          ))}
        </div>
        <div className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 text-lg font-bold">Delivery</h2>
            <p className="text-ink-soft">{a.recipient_name} · {a.phone}<br />{a.line1}{a.barangay && `, ${a.barangay}`}<br />{a.city}, {a.province} {a.postal_code}</p>
            {o.notes && <p className="mt-3 rounded-lg bg-paper p-3">“{o.notes}”</p>}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 text-lg font-bold">Payments</h2>
            <ul className="space-y-2">
              {o.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="uppercase">{p.method.replace('_', ' ')}</span>
                    {p.transaction_reference && <span className="block font-mono text-xs text-ink-mute">{p.transaction_reference}</span>}
                    {p.failure_reason && p.status !== 'paid' && <span className="block text-xs text-ink-mute">{p.failure_reason}</span>}
                    {p.needs_refund && <span className="block text-xs font-semibold text-coral">Refund needed</span>}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">{money(p.amount)} <StatusBadge status={p.status} /></span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold"><span>Order total</span><span>{money(o.grand_total)}</span></div>
          </section>
        </div>
      </div>
    </>
  )
}
