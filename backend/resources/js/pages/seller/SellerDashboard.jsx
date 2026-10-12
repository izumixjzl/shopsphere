import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import DateRange, { defaultRange } from '../../components/DateRange'
import { BarList, SalesChart, StatCard, StatusDoughnut } from '../../components/charts'
import { Button, PageLoader, StatusBadge, Table } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { download, errorMessage } from '../../lib/api'
import { date, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

export function ReportButtons({ url, range, extra = {} }) {
  const [busy, setBusy] = useState(null)
  const toast = useToast()
  const get = async (format) => {
    setBusy(format)
    try { await download(url, { format, ...range, ...extra }) } catch (e) { toast(errorMessage(e, 'Could not create the report.'), 'error') } finally { setBusy(null) }
  }
  return (
    <>
      <Button variant="outline" size="sm" loading={busy === 'csv'} onClick={() => get('csv')}><Download className="size-4" /> CSV</Button>
      <Button variant="outline" size="sm" loading={busy === 'pdf'} onClick={() => get('pdf')}><Download className="size-4" /> PDF</Button>
    </>
  )
}

export function changeNote(pct) {
  if (pct == null) return { note: 'No sales in the previous period' }
  return { note: `${pct >= 0 ? '+' : ''}${pct}% vs previous period`, tone: pct >= 0 ? 'up' : 'down' }
}

export default function SellerDashboard() {
  const [range, setRange] = useState(defaultRange(30))
  const { data, loading } = useFetch('/seller/dashboard', range)

  if (loading && !data) return <PageLoader />
  const k = data.kpis

  return (
    <>
      <PageHeader title="Store overview" description={`${date(data.range.from)} – ${date(data.range.to)}`}
        actions={<><DateRange value={range} onChange={setRange} /><ReportButtons url="/seller/reports/sales" range={range} /></>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross sales" value={money(k.gross_sales)} {...changeNote(k.gross_sales_change_pct)} />
        <StatCard label="Your earnings" value={money(k.net_earnings)} note={`After ${money(k.commission)} commission`} />
        <StatCard label="Orders" value={k.orders} note={`${k.pending_orders} waiting for you`} tone={k.pending_orders ? 'warn' : undefined} />
        <StatCard label="Low stock" value={k.low_stock_products} note={`${k.active_products} active products`} tone={k.low_stock_products ? 'warn' : undefined} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Sales</h2><SalesChart series={data.sales} /></section>
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Order status</h2><StatusDoughnut breakdown={data.status_breakdown} /></section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Best sellers</h2><BarList rows={data.best_sellers} /></section>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-2">
            <h2 className="text-lg font-bold">Running low</h2>
            <Link to="/seller/products?stock=low" className="text-sm font-semibold text-sphere hover:underline">Manage stock</Link>
          </div>
          {data.low_stock.length === 0 ? <p className="px-5 pb-6 text-sm text-ink-mute">Every product is above its low-stock level.</p> : (
            <ul className="divide-y divide-line">
              {data.low_stock.map((p) => (
                <li key={p.product_id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div><div className="font-medium">{p.name}</div><div className="text-ink-mute">{p.sku}</div></div>
                  <span className={`rounded-full px-2.5 py-0.5 font-semibold ${p.quantity === 0 ? 'bg-coral-tint text-coral' : 'bg-mango-tint text-[#8a5a00]'}`}>{p.quantity === 0 ? 'Out of stock' : `${p.quantity} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold">Recent orders</h2>
          <Link to="/seller/orders" className="text-sm font-semibold text-sphere hover:underline">All orders</Link>
        </div>
        <Table rows={data.recent_orders} columns={[
          { key: 'reference', label: 'Order', render: (r) => <Link to={`/seller/orders/${r.id}`} className="font-medium hover:text-sphere">{r.reference}</Link> },
          { key: 'customer', label: 'Customer', render: (r) => r.order?.customer?.name },
          { key: 'created_at', label: 'Placed', render: (r) => date(r.created_at) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'subtotal', label: 'Amount', align: 'right', render: (r) => money(r.subtotal) },
        ]} />
      </section>
    </>
  )
}
