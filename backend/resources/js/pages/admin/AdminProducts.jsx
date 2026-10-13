import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Search } from 'lucide-react'
import { Button, EmptyState, Modal, Pagination, Select, StatusBadge, Table, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { money } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

function ModerateModal({ product, onClose, onSaved }) {
  const [status, setStatus] = useState(product.moderation_status === 'approved' ? 'flagged' : 'approved')
  const [note, setNote] = useState(product.moderation_note || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function save() {
    setSaving(true); setError(null)
    try {
      const { data } = await api.patch(`/admin/products/${product.id}/moderation`, { moderation_status: status, moderation_note: note || null })
      toast(`Listing ${status}`)
      onSaved(data)
    } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Moderate “${product.name}”`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={status === 'removed' ? 'danger' : 'primary'} loading={saving} onClick={save}>Save decision</Button></>}>
      <div className="grid gap-4">
        <Select label="Decision" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="approved">Approved — visible in the shop</option>
          <option value="flagged">Flagged — hidden until the seller fixes it</option>
          <option value="removed">Removed — violates marketplace rules</option>
        </Select>
        <Textarea label="Note to the seller" value={note} onChange={(e) => setNote(e.target.value)} error={error} hint="Required when flagging or removing." />
      </div>
    </Modal>
  )
}

export default function AdminProducts() {
  const [mod, setMod] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, loading, setData } = useFetch('/admin/products', { moderation_status: mod || undefined, q: dq || undefined, page })
  const [target, setTarget] = useState(null)

  return (
    <>
      <PageHeader title="Listings" description="Every product across the marketplace. Flag or remove listings that break the rules." />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-9" placeholder="Product name or SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="Search listings" />
          </div>
          <Select aria-label="Moderation" className="w-44" value={mod} onChange={(e) => { setMod(e.target.value); setPage(1) }}>
            <option value="">All listings</option><option value="approved">Approved</option><option value="flagged">Flagged</option><option value="removed">Removed</option>
          </Select>
        </div>
        <Table loading={loading} rows={data?.data} empty={<EmptyState icon={Package} title="No listings match" />}
          columns={[
            { key: 'name', label: 'Product', render: (r) => (
              <div className="flex items-center gap-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-paper">{r.image_url && <img src={r.image_url} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0"><Link to={`/products/${r.slug}`} className="block truncate font-medium hover:text-sphere" target="_blank">{r.name}</Link><div className="text-xs text-ink-mute">{r.sku}</div></div>
              </div>) },
            { key: 'store', label: 'Store', render: (r) => r.seller?.store_name },
            { key: 'price', label: 'Price', align: 'right', render: (r) => money(r.price) },
            { key: 'stock', label: 'Stock', align: 'right' },
            { key: 'status', label: 'Seller status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'moderation_status', label: 'Moderation', render: (r) => <StatusBadge status={r.moderation_status} /> },
            { key: 'open_reports_count', label: 'Open reports', align: 'right', render: (r) => r.open_reports_count
              ? <Link to="/admin/reports" className="font-semibold text-coral hover:underline">{r.open_reports_count}</Link> : <span className="text-ink-mute">0</span> },
            { key: 'a', label: '', align: 'right', render: (r) => <button onClick={() => setTarget(r)} className="rounded-full px-3 py-1 text-sm font-medium text-sphere hover:bg-sphere-tint">Moderate</button> },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
      {target && <ModerateModal product={target} onClose={() => setTarget(null)}
        onSaved={(p) => { setData((d) => ({ ...d, data: d.data.map((x) => (x.id === p.id ? p : x)) })); setTarget(null) }} />}
    </>
  )
}
