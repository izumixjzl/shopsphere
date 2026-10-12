import { useState } from 'react'
import { StatCard } from '../../components/charts'
import { PageLoader, Pagination, StatusBadge, Table } from '../../components/ui'
import { PageHeader } from '../../layouts/DashboardLayout'
import { date, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

export default function SellerFinance() {
  const [page, setPage] = useState(1)
  const { data, loading } = useFetch('/seller/finance', { page })
  if (loading && !data) return <PageLoader />
  const s = data.summary

  return (
    <>
      <PageHeader title="Earnings & payouts" description={`Your commission rate is ${data.commission_rate}% of item sales. Shipping fees go to you in full.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ready for payout" value={money(s.payable.net)} note={`${s.payable.records} delivered orders`} tone="up" />
        <StatCard label="Awaiting delivery" value={money(s.pending.net)} note={`${s.pending.records} open orders`} />
        <StatCard label="Paid out" value={money(s.paid.net)} note={`${money(s.paid.commission)} commission`} />
        <StatCard label="Reversed" value={money(s.reversed.net)} note="Cancelled or returned" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <h2 className="p-5 pb-2 text-lg font-bold">Commission ledger</h2>
          <Table rows={data.records.data} columns={[
            { key: 'ref', label: 'Order', render: (r) => r.seller_order?.reference },
            { key: 'gross_amount', label: 'Sales', align: 'right', render: (r) => money(r.gross_amount) },
            { key: 'commission_amount', label: 'Commission', align: 'right', render: (r) => `−${money(r.commission_amount)}` },
            { key: 'net_amount', label: 'Net', align: 'right', render: (r) => money(r.net_amount) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]} />
          <div className="px-5 pb-4"><Pagination meta={{ current_page: data.records.current_page, last_page: data.records.last_page, total: data.records.total }} onPage={setPage} /></div>
        </section>
        <section className="card overflow-hidden">
          <h2 className="p-5 pb-2 text-lg font-bold">Payout history</h2>
          {data.payouts.length === 0 ? <p className="px-5 pb-6 text-sm text-ink-mute">No payouts yet. Payouts are sent by the marketplace for delivered orders.</p> : (
            <ul className="divide-y divide-line">
              {data.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div><div className="font-medium">{p.reference}</div><div className="text-ink-mute">{p.paid_at ? `Paid ${date(p.paid_at)}` : `Created ${date(p.created_at)}`}</div></div>
                  <div className="text-right"><div className="font-semibold tabular-nums">{money(p.amount)}</div><StatusBadge status={p.status} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
