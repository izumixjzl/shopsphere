import { useState } from 'react'
import { Link } from 'react-router-dom'
import DateRange, { defaultRange } from '../../components/DateRange'
import { BarList, SalesChart, StatCard, StatusDoughnut } from '../../components/charts'
import { PageLoader, StatusBadge, Table } from '../../components/ui'
import { PageHeader } from '../../layouts/DashboardLayout'
import { date, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { ReportButtons, changeNote } from '../seller/SellerDashboard'

export default function AdminDashboard() {
  const [range, setRange] = useState(defaultRange(30))
  const { data, loading } = useFetch('/admin/dashboard', range)
  if (loading && !data) return <PageLoader />
  const k = data.kpis

  return (
    <>
      <PageHeader title="Marketplace overview" description={`${date(data.range.from)} – ${date(data.range.to)}`}
        actions={<><DateRange value={range} onChange={setRange} /><ReportButtons url="/admin/reports/sales" range={range} /></>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross merchandise value" value={money(k.gross_sales)} {...changeNote(k.gross_sales_change_pct)} />
        <StatCard label="Commission earned" value={money(k.commission)} note={`${k.orders} seller orders`} />
        <StatCard label="Sellers" value={k.approved_sellers} note={k.pending_sellers ? `${k.pending_sellers} awaiting approval` : 'No pending applications'} tone={k.pending_sellers ? 'warn' : undefined} />
        <StatCard label="Open disputes" value={k.open_disputes} note={`${k.customers} customers`} tone={k.open_disputes ? 'warn' : undefined} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Sales across all stores</h2><SalesChart series={data.sales} /></section>
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Seller order status</h2><StatusDoughnut breakdown={data.status_breakdown} /></section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Top stores</h2><BarList rows={data.top_sellers} valueKey="sales" labelKey="store_name" /></section>
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Best-selling products</h2><BarList rows={data.best_sellers} /></section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold">Latest checkouts</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-sphere hover:underline">All orders</Link>
        </div>
        <Table rows={data.recent_orders} columns={[
          { key: 'order_number', label: 'Order', render: (r) => <Link to={`/admin/orders/${r.id}`} className="font-medium hover:text-sphere">{r.order_number}</Link> },
          { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
          { key: 'stores', label: 'Stores', align: 'right', render: (r) => r.seller_orders_count },
          { key: 'placed_at', label: 'Placed', render: (r) => date(r.placed_at) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'grand_total', label: 'Total', align: 'right', render: (r) => money(r.grand_total) },
        ]} />
      </section>
    </>
  )
}
