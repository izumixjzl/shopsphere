import { useState } from 'react'
import { Download, Search, Store } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, StatusBadge, Table, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, download, errorMessage, fieldErrors } from '../../lib/api'
import { date, humanize } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

const TABS = [['pending', 'Awaiting approval'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended'], ['', 'All']]

function SellerPanel({ seller, onClose, onChanged }) {
  const [action, setAction] = useState(null) // approve | reject | suspend
  const [reason, setReason] = useState('')
  const [rate, setRate] = useState(seller.commission_rate ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()

  async function run(fn, done) {
    setBusy(true); setError(null)
    try { const { data } = await fn(); toast(done); onChanged(data); setAction(null) } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setBusy(false) }
  }

  const decide = () => run(() => api.post(`/admin/sellers/${seller.id}/${action}`, { reason }),
    { approve: 'Store approved', reject: 'Application rejected', suspend: 'Store suspended' }[action])

  return (
    <Modal open onClose={onClose} title={seller.store_name} size="lg"
      footer={<>
        {seller.status !== 'approved' && <Button onClick={() => setAction('approve')}>Approve store</Button>}
        {seller.status === 'pending' && <Button variant="outline" onClick={() => setAction('reject')}>Reject</Button>}
        {seller.status === 'approved' && <Button variant="danger" onClick={() => setAction('suspend')}>Suspend store</Button>}
      </>}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-mute">Owner</dt><dd>{seller.owner?.name} · {seller.owner?.email}</dd></div>
        <div><dt className="text-ink-mute">Status</dt><dd><StatusBadge status={seller.status} /></dd></div>
        <div><dt className="text-ink-mute">Contact</dt><dd>{seller.contact_phone || '—'}</dd></div>
        <div><dt className="text-ink-mute">Address</dt><dd>{seller.business_address || '—'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-ink-mute">About</dt><dd>{seller.description || '—'}</dd></div>
        {seller.rejection_reason && <div className="sm:col-span-2"><dt className="text-ink-mute">Last reason given</dt><dd>{seller.rejection_reason}</dd></div>}
      </dl>

      <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal">Documents</h3>
      {seller.verifications?.length ? (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
          {seller.verifications.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span>{humanize(v.document_type)} · {date(v.created_at)}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={v.status} />
                <Button size="sm" variant="ghost" onClick={() => download(`/admin/verifications/${v.id}/download`).catch((e) => toast(errorMessage(e), 'error'))}><Download className="size-4" /> View</Button>
                {v.status === 'pending' && <>
                  <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/admin/verifications/${v.id}`, { status: 'approved' }).then(() => api.get(`/admin/sellers/${seller.id}`)), 'Document accepted')}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => run(() => api.patch(`/admin/verifications/${v.id}`, { status: 'rejected' }).then(() => api.get(`/admin/sellers/${seller.id}`)), 'Document rejected')}>Reject</Button>
                </>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-ink-mute">No documents uploaded yet.</p>}

      <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal">Commission</h3>
      <div className="mt-2 flex items-end gap-2">
        <Input className="w-40" type="number" min="0" max="50" step="0.5" label="Rate (%)" value={rate} onChange={(e) => setRate(e.target.value)} hint={`Blank = default (${seller.effective_commission_rate}% now)`} />
        <Button variant="outline" loading={busy && !action} onClick={() => run(() => api.patch(`/admin/sellers/${seller.id}/commission`, { commission_rate: rate === '' ? null : Number(rate) }), 'Commission updated')}>Save rate</Button>
      </div>
      {error && !action && <p className="mt-3 text-sm text-coral">{error}</p>}

      <ConfirmDialog open={Boolean(action)} onClose={() => setAction(null)} onConfirm={decide} loading={busy}
        tone={action === 'approve' ? 'primary' : 'danger'}
        title={{ approve: 'Approve this store?', reject: 'Reject this application?', suspend: 'Suspend this store?' }[action] || ''}
        confirmLabel={{ approve: 'Approve store', reject: 'Reject application', suspend: 'Suspend store' }[action]}
        message={action === 'approve' ? 'The seller can list products and receive orders immediately.' : 'The seller sees this reason in their dashboard.'}>
        {action && action !== 'approve' && <div className="mt-3"><Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
        {error && action && <p className="mt-2 text-sm text-coral">{error}</p>}
      </ConfirmDialog>
    </Modal>
  )
}

export default function AdminSellers() {
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, loading, reload } = useFetch('/admin/sellers', { status: status || undefined, q: dq || undefined, page })
  const [open, setOpen] = useState(null)

  return (
    <>
      <PageHeader title="Sellers" description="Review applications, verify documents and set commission rates." />
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
            <input className="field pl-9" placeholder="Store name or owner email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sellers" />
          </div>
        </div>
        <Table loading={loading} rows={data?.data} onRowClick={setOpen}
          empty={<EmptyState icon={Store} title="No stores in this list" />}
          columns={[
            { key: 'store_name', label: 'Store', render: (r) => <div><div className="font-medium">{r.store_name}</div><div className="text-xs text-ink-mute">{r.owner?.email}</div></div> },
            { key: 'docs', label: 'Documents', render: (r) => `${r.verifications?.length || 0} uploaded` },
            { key: 'rate', label: 'Commission', align: 'right', render: (r) => `${r.effective_commission_rate}%` },
            { key: 'created_at', label: 'Applied', render: (r) => date(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
      {open && <SellerPanel seller={open} onClose={() => setOpen(null)} onChanged={(s) => { setOpen(s); reload() }} />}
    </>
  )
}
