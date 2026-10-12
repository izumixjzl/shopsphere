import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Search } from 'lucide-react'
import { EmptyState, Pagination, StatusBadge, Table } from '../../components/ui'
import { PageHeader } from '../../layouts/DashboardLayout'
import { date, money } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

const TABS = [['', 'All'], ['pending', 'To confirm'], ['confirmed', 'To pack'], ['packed', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]

export default function SellerOrders() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, loading } = useFetch('/seller/orders', { status: status || undefined, q: dq || undefined, page })
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="Orders" description="Confirm, pack and ship the orders placed with your store." />
      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
          {TABS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1) }}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${status === v ? 'border-sphere text-sphere' : 'border-transparent text-ink-soft hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <div className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-9" placeholder="Order reference or customer name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="Search orders" />
          </div>
        </div>
        <Table loading={loading} rows={data?.data} onRowClick={(r) => navigate(`/seller/orders/${r.id}`)}
          empty={<EmptyState icon={Inbox} title="No orders here">Orders appear as soon as customers check out with your products.</EmptyState>}
          columns={[
            { key: 'reference', label: 'Order', render: (r) => <span className="font-medium">{r.reference}</span> },
            { key: 'customer', label: 'Customer', render: (r) => r.order?.customer?.name },
            { key: 'items_count', label: 'Items', align: 'right' },
            { key: 'created_at', label: 'Placed', render: (r) => date(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'seller_earnings', label: 'Your earnings', align: 'right', render: (r) => money(r.seller_earnings) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
    </>
  )
}
