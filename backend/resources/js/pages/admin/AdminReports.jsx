import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { Button, EmptyState, Modal, Pagination, Select, StatusBadge, Table, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { dateTime } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

function ReviewModal({ report, onClose, onSaved }) {
  const [status, setStatus] = useState('resolved')
  const [moderation, setModeration] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const product = report.product

  async function save() {
    if (moderation && moderation !== 'approved' && !note.trim()) return setError('Add a note so the seller knows what to fix.')
    setSaving(true); setError(null)
    try {
      if (moderation && product) {
        await api.patch(`/admin/products/${product.id}/moderation`, { moderation_status: moderation, moderation_note: note })
      }
      const { data } = await api.post(`/admin/reports/${report.id}/resolve`, { status, admin_note: note || null })
      toast(status === 'resolved' ? 'Report resolved' : 'Report dismissed')
      onSaved(data)
    } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Review report"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save decision</Button></>}>
      <div className="grid gap-4">
        <div className="rounded-xl bg-paper p-3 text-sm">
          <div className="font-semibold">{report.reason_label}</div>
          {report.details && <p className="mt-1 text-ink-soft">{report.details}</p>}
          <p className="mt-2 text-xs text-ink-mute">Reported by {report.reporter?.name} · {dateTime(report.created_at)}</p>
        </div>
        <Select label="Decision" value={status} onChange={(e) => { setStatus(e.target.value); setModeration('') }}>
          <option value="resolved">Resolved — the report was valid</option>
          <option value="dismissed">Dismissed — no rule was broken</option>
        </Select>
        {product && (status === 'resolved' || product.moderation_status !== 'approved') && (
          <Select label="Action on the listing" value={moderation} onChange={(e) => setModeration(e.target.value)}
            hint={product.moderation_status === 'flagged' && product.moderation_note?.startsWith('Hidden automatically')
              ? 'Hidden automatically after several reports. Restore it if the reports were unfounded.'
              : `Currently ${product.moderation_status}.`}>
            <option value="">No change</option>
            {product.moderation_status !== 'approved' && <option value="approved">Restore — show it in the shop again</option>}
            {status === 'resolved' && product.moderation_status !== 'flagged' && <option value="flagged">Flag — hide until the seller fixes it</option>}
            {status === 'resolved' && product.moderation_status !== 'removed' && <option value="removed">Remove — violates marketplace rules</option>}
          </Select>
        )}
        <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} error={error}
          hint={moderation && moderation !== 'approved' ? 'Sent to the seller with the moderation decision.' : 'Optional. Kept with the report.'} />
      </div>
    </Modal>
  )
}

const TABS = [['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['', 'All']]

export default function AdminReports() {
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const { data, loading, setData } = useFetch('/admin/reports', { status: status || undefined, page })
  const [target, setTarget] = useState(null)

  return (
    <>
      <PageHeader title="Reports" description="Listings customers flagged as fake, prohibited, misleading or unsafe." />
      <div className="card">
        <div className="flex flex-wrap gap-1 border-b border-line p-3" role="tablist">
          {TABS.map(([value, label]) => (
            <button key={label} role="tab" aria-selected={status === value} onClick={() => { setStatus(value); setPage(1) }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === value ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5'}`}>
              {label}
            </button>
          ))}
        </div>
        <Table loading={loading} rows={data?.data}
          empty={<EmptyState icon={Flag} title={status === 'open' ? 'No open reports' : 'No reports here'}>Reports from customers will show up here.</EmptyState>}
          columns={[
            { key: 'product', label: 'Listing', render: (r) => r.product ? (
              <div className="flex items-center gap-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-paper">{r.product.image_url && <img src={r.product.image_url} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0">
                  <Link to={`/products/${r.product.slug}`} target="_blank" className="block truncate font-medium hover:text-sphere">{r.product.name}</Link>
                  <div className="text-xs text-ink-mute">{r.product.seller?.store_name}</div>
                </div>
              </div>) : <span className="text-ink-mute">Deleted listing</span> },
            { key: 'reason', label: 'Reason', render: (r) => (
              <div className="max-w-64">
                <div className="font-medium">{r.reason_label}</div>
                {r.details && <div className="truncate text-xs text-ink-mute" title={r.details}>{r.details}</div>}
              </div>) },
            { key: 'reporter', label: 'Reported by', render: (r) => r.reporter?.name },
            { key: 'created_at', label: 'Date', render: (r) => dateTime(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'a', label: '', align: 'right', render: (r) => r.status === 'open'
              ? <button onClick={() => setTarget(r)} className="rounded-full px-3 py-1 text-sm font-medium text-sphere hover:bg-sphere-tint">Review</button>
              : <span className="text-xs text-ink-mute">{r.resolver?.name}</span> },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
      {target && <ReviewModal report={target} onClose={() => setTarget(null)}
        onSaved={(saved) => {
          // Reviewed reports drop out of the "Open" tab.
          setData((d) => ({ ...d, data: status === 'open' ? d.data.filter((x) => x.id !== saved.id) : d.data.map((x) => (x.id === saved.id ? saved : x)) }))
          setTarget(null)
        }} />}
    </>
  )
}
