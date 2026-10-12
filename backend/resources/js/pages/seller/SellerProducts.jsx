import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Package, Plus, Search } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, StatusBadge, Table } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { money } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

function StockModal({ product, onClose, onSaved }) {
  const [stock, setStock] = useState(product.stock ?? 0)
  const [threshold, setThreshold] = useState(product.low_stock_threshold ?? 5)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function save() {
    setSaving(true); setErrors({})
    try {
      const { data } = await api.patch(`/seller/products/${product.id}/stock`, { stock: Number(stock), low_stock_threshold: Number(threshold) })
      toast('Stock updated')
      onSaved(data)
    } catch (e) { setErrors(fieldErrors(e)); if (!e.response?.data?.errors) toast(errorMessage(e), 'error') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Stock for ${product.name}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save stock</Button></>}>
      <div className="grid gap-4">
        <Input label="Units in stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} error={errors.stock} />
        <Input label="Warn me when stock is at or below" type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} error={errors.low_stock_threshold} />
      </div>
    </Modal>
  )
}

export default function SellerProducts() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const dq = useDebounced(q)
  const filters = { q: dq || undefined, status: params.get('status') || undefined, stock: params.get('stock') || undefined, page: params.get('page') || 1 }
  const { data, loading, setData } = useFetch('/seller/products', filters)
  const [stockFor, setStockFor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const set = (k, v) => {
    const n = new URLSearchParams(params)
    v ? n.set(k, v) : n.delete(k)
    if (k !== 'page') n.delete('page')
    setParams(n)
  }

  const replaceRow = (p) => setData((d) => ({ ...d, data: d.data.map((x) => (x.id === p.id ? p : x)) }))

  async function remove() {
    setBusy(true)
    try {
      await api.delete(`/seller/products/${deleting.id}`)
      setData((d) => ({ ...d, data: d.data.filter((x) => x.id !== deleting.id) }))
      toast('Product deleted')
      setDeleting(null)
    } catch (e) { toast(errorMessage(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Products" description="Listings, prices and stock for your store."
        actions={<Button to="/seller/products/new"><Plus className="size-4" /> Add product</Button>} />

      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-9" placeholder="Search by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          </div>
          <Select aria-label="Status" className="w-40" value={params.get('status') || ''} onChange={(e) => set('status', e.target.value)}>
            <option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option>
          </Select>
          <Select aria-label="Stock" className="w-40" value={params.get('stock') || ''} onChange={(e) => set('stock', e.target.value)}>
            <option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </Select>
        </div>

        <Table loading={loading} rows={data?.data} onRowClick={(r) => navigate(`/seller/products/${r.id}`)}
          empty={<EmptyState icon={Package} title="No products found" action={<Button to="/seller/products/new">Add your first product</Button>}>Add a product with photos, a price and stock to start selling.</EmptyState>}
          columns={[
            { key: 'name', label: 'Product', render: (r) => (
              <div className="flex items-center gap-3">
                <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-paper">{r.image_url && <img src={r.image_url} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="text-xs text-ink-mute">{r.sku} · {r.category?.name}</div></div>
              </div>) },
            { key: 'price', label: 'Price', align: 'right', render: (r) => money(r.price) },
            { key: 'stock', label: 'Stock', align: 'right', render: (r) => (
              <button onClick={(e) => { e.stopPropagation(); setStockFor(r) }}
                className={`rounded-full px-2.5 py-0.5 font-semibold tabular-nums hover:ring-2 hover:ring-sphere/20 ${r.stock === 0 ? 'bg-coral-tint text-coral' : r.is_low_stock ? 'bg-mango-tint text-[#8a5a00]' : 'bg-ink/5'}`}
                aria-label={`Edit stock for ${r.name}`}>{r.stock}</button>) },
            { key: 'sales_count', label: 'Sold', align: 'right' },
            { key: 'status', label: 'Status', render: (r) => (
              <div className="flex flex-col items-start gap-1">
                <StatusBadge status={r.status} />
                {r.moderation_status !== 'approved' && <StatusBadge status={r.moderation_status} />}
              </div>) },
            { key: 'actions', label: '', align: 'right', render: (r) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Link to={`/seller/products/${r.id}`} className="rounded-full px-3 py-1 text-sm font-medium text-sphere hover:bg-sphere-tint">Edit</Link>
                <button onClick={() => setDeleting(r)} className="rounded-full px-3 py-1 text-sm font-medium text-coral hover:bg-coral-tint">Delete</button>
              </div>) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} /></div>
      </div>

      {stockFor && <StockModal product={stockFor} onClose={() => setStockFor(null)} onSaved={(p) => { replaceRow(p); setStockFor(null) }} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy} tone="danger"
        title="Delete this product?" confirmLabel="Delete product"
        message={`“${deleting?.name}” will be removed from your store. Past orders keep their records.`} />
    </>
  )
}
