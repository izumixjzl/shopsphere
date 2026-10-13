import { useState } from 'react'
import { Download, Search, Store } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, Input, Modal, Pagination, Skeleton, Stars, StatusBadge, Table, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, download, errorMessage, fieldErrors } from '../../lib/api'
import { date, dateTime, humanize } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

// [value, label, query]
const TABS = [
  ['pending', 'Awaiting approval', { status: 'pending' }],
  ['appeals', 'Open appeals', { appeal: 'open' }],
  ['approved', 'Approved', { status: 'approved' }],
  ['rejected', 'Rejected', { status: 'rejected' }],
  ['suspended', 'Suspended', { status: 'suspended' }],
  ['', 'All', {}],
]

const ACTION_LABELS = {
  approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended', reinstated: 'Reinstated',
  appeal_filed: 'Appeal filed', appeal_accepted: 'Appeal accepted', appeal_denied: 'Appeal denied',
  verification_approved: 'Document accepted', verification_rejected: 'Document rejected',
  commission_updated: 'Commission changed',
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="text-xs text-ink-mute">{label}</div>
      <div className={`font-display text-lg font-bold ${tone || ''}`}>{value}</div>
    </div>
  )
}

/** Rating, report and moderation record, plus every account decision so far. */
function TrustSummary({ sellerId, version }) {
  const { data, loading } = useFetch(`/admin/sellers/${sellerId}/trust`, { v: version })
  if (loading && !data) return <Skeleton className="mt-6 h-24" />
  if (!data) return null

  return (
    <>
      <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal">Trust signals</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={`Rating · ${data.rating.count} verified`} value={data.rating.count ? <span className="flex items-center gap-1.5">{data.rating.avg.toFixed(1)} <Stars value={data.rating.avg} size="size-3.5" /></span> : '—'} />
        <Stat label="Reports upheld / open" value={`${data.reports.upheld} / ${data.reports.open}`} tone={data.reports.upheld ? 'text-coral' : ''} />
        <Stat label="Listings flagged / removed" value={`${data.listings.flagged} / ${data.listings.removed}`} tone={data.listings.removed ? 'text-coral' : ''} />
        <Stat label="Orders delivered / cancelled" value={`${data.orders.delivered} / ${data.orders.cancelled}`} />
      </div>
      {data.history.length > 0 && (
        <>
          <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal">Account history {data.suspensions > 0 && <span className="font-normal text-ink-mute">· suspended {data.suspensions}×</span>}</h3>
          <ol className="mt-2 max-h-56 space-y-2 overflow-y-auto border-l-2 border-line pl-4 text-sm">
            {data.history.map((h) => (
              <li key={h.id}>
                <span className="font-medium">{ACTION_LABELS[h.action.replace('seller.', '')] || humanize(h.action.replace('seller.', ''))}</span>
                <span className="text-ink-mute"> · {dateTime(h.created_at)}{h.by && ` · ${h.by.name}`}</span>
                {h.reason && <div className="text-ink-soft">{h.reason}</div>}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

function SellerPanel({ seller, onClose, onChanged }) {
  const [action, setAction] = useState(null) // approve | reject | suspend | reject_doc:<id> | appeal_accepted | appeal_denied
  const [reason, setReason] = useState('')
  const [rate, setRate] = useState(seller.commission_rate ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)
  const toast = useToast()
  const openAppeal = seller.appeals?.find((a) => a.status === 'open')
  const suspended = seller.status === 'suspended'
  const canApprove = suspended || seller.has_accepted_document

  async function run(fn, done) {
    setBusy(true); setError(null)
    try {
      const { data } = await fn()
      toast(done); onChanged(data); setAction(null); setReason(''); setVersion((v) => v + 1)
    } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setBusy(false) }
  }

  const refetch = () => api.get(`/admin/sellers/${seller.id}`)

  function confirm() {
    if (action?.startsWith('reject_doc:')) {
      const id = action.split(':')[1]
      return run(() => api.patch(`/admin/verifications/${id}`, { status: 'rejected', notes: reason }).then(refetch), 'Document rejected')
    }
    if (action?.startsWith('appeal_')) {
      const status = action.replace('appeal_', '')
      return run(() => api.post(`/admin/seller-appeals/${openAppeal.id}/decide`, { status, admin_note: reason || null }),
        status === 'accepted' ? 'Appeal accepted — store reinstated' : 'Appeal denied')
    }
    return run(() => api.post(`/admin/sellers/${seller.id}/${action}`, { reason }),
      { approve: suspended ? 'Store reinstated' : 'Store approved', reject: 'Application rejected', suspend: 'Store suspended' }[action])
  }

  const dialog = {
    approve: suspended
      ? ['Reinstate this store?', 'Reinstate store', 'Listings return to the shop immediately. Any open appeal is closed as accepted.']
      : ['Approve this store?', 'Approve store', 'The seller can list products and receive orders immediately.'],
    reject: ['Reject this application?', 'Reject application', 'The seller sees this reason and can upload new documents to re-apply.'],
    suspend: ['Suspend this store?', 'Suspend store', 'Listings are hidden right away. The seller sees this reason and can appeal.'],
    appeal_accepted: ['Accept this appeal?', 'Accept and reinstate', 'The store is reinstated. The note below is optional and sent to the seller.'],
    appeal_denied: ['Deny this appeal?', 'Deny appeal', 'The store stays suspended. Tell the seller why.'],
  }[action?.startsWith('reject_doc:') ? 'reject_doc' : action] || ['Reject this document?', 'Reject document', 'Tell the seller what was wrong so they can upload a better one.']
  const needsReason = action && action !== 'approve' && action !== 'appeal_accepted'

  return (
    <Modal open onClose={onClose} title={seller.store_name} size="lg"
      footer={<>
        {seller.status !== 'approved' && (
          <span title={canApprove ? undefined : 'Accept a verification document first'}>
            <Button disabled={!canApprove} onClick={() => setAction('approve')}>{suspended ? 'Reinstate store' : 'Approve store'}</Button>
          </span>
        )}
        {seller.status === 'pending' && <Button variant="outline" onClick={() => setAction('reject')}>Reject</Button>}
        {seller.status === 'approved' && <Button variant="danger" onClick={() => setAction('suspend')}>Suspend store</Button>}
      </>}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-mute">Owner</dt><dd>{seller.owner?.name} · {seller.owner?.email}</dd></div>
        <div><dt className="text-ink-mute">Status</dt><dd><StatusBadge status={seller.status} />{seller.suspended_at && <span className="ml-2 text-ink-mute">since {date(seller.suspended_at)}</span>}</dd></div>
        <div><dt className="text-ink-mute">Contact</dt><dd>{seller.contact_phone || '—'}</dd></div>
        <div><dt className="text-ink-mute">Address</dt><dd>{seller.business_address || '—'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-ink-mute">About</dt><dd>{seller.description || '—'}</dd></div>
        {seller.rejection_reason && <div className="sm:col-span-2"><dt className="text-ink-mute">Last reason given</dt><dd>{seller.rejection_reason}</dd></div>}
      </dl>

      {openAppeal && (
        <section className="mt-6 rounded-xl border border-mango bg-mango-tint/40 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold tracking-normal">Appeal · {dateTime(openAppeal.created_at)}</h3>
            <span className="flex gap-2">
              <Button size="sm" onClick={() => setAction('appeal_accepted')}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => setAction('appeal_denied')}>Deny</Button>
            </span>
          </div>
          {openAppeal.suspension_reason && <p className="mt-1 text-ink-mute">Suspended for: {openAppeal.suspension_reason}</p>}
          <p className="mt-2 whitespace-pre-line">{openAppeal.message}</p>
        </section>
      )}

      <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal">Documents</h3>
      {seller.verifications?.length ? (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
          {seller.verifications.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span>{humanize(v.document_type)} · {date(v.created_at)}{v.status === 'rejected' && v.notes && <span className="block text-xs text-ink-mute">{v.notes}</span>}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={v.status} />
                <Button size="sm" variant="ghost" onClick={() => download(`/admin/verifications/${v.id}/download`).catch((e) => toast(errorMessage(e), 'error'))}><Download className="size-4" /> View</Button>
                {v.status === 'pending' && <>
                  <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/admin/verifications/${v.id}`, { status: 'approved' }).then(refetch), 'Document accepted')}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAction(`reject_doc:${v.id}`)}>Reject</Button>
                </>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-ink-mute">No documents uploaded yet.</p>}
      {!canApprove && <p className="mt-2 text-sm text-ink-mute">Accept at least one document before approving this store.</p>}

      <TrustSummary sellerId={seller.id} version={version} />

      <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal">Commission</h3>
      <div className="mt-2 flex items-end gap-2">
        <Input className="w-40" type="number" min="0" max="50" step="0.5" label="Rate (%)" value={rate} onChange={(e) => setRate(e.target.value)} hint={`Blank = default (${seller.effective_commission_rate}% now)`} />
        <Button variant="outline" loading={busy && !action} onClick={() => run(() => api.patch(`/admin/sellers/${seller.id}/commission`, { commission_rate: rate === '' ? null : Number(rate) }), 'Commission updated')}>Save rate</Button>
      </div>
      {error && !action && <p className="mt-3 text-sm text-coral">{error}</p>}

      <ConfirmDialog open={Boolean(action)} onClose={() => { setAction(null); setError(null) }} onConfirm={confirm} loading={busy}
        tone={action === 'approve' || action === 'appeal_accepted' ? 'primary' : 'danger'}
        title={dialog[0]} confirmLabel={dialog[1]} message={dialog[2]}>
        {action && action !== 'approve' && (
          <div className="mt-3"><Textarea label={needsReason ? 'Reason' : 'Note (optional)'} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        )}
        {error && action && <p className="mt-2 text-sm text-coral">{error}</p>}
      </ConfirmDialog>
    </Modal>
  )
}

export default function AdminSellers() {
  const [tab, setTab] = useState('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const query = TABS.find(([v]) => v === tab)[2]
  const { data, loading, reload } = useFetch('/admin/sellers', { ...query, q: dq || undefined, page })
  const [open, setOpen] = useState(null)

  return (
    <>
      <PageHeader title="Sellers" description="Review applications and documents, handle suspensions and appeals, and set commission rates." />
      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
          {TABS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setPage(1) }}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${tab === v ? 'border-sphere text-sphere' : 'border-transparent text-ink-soft hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <div className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-9" placeholder="Store name or owner email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sellers" />
          </div>
        </div>
        <Table loading={loading} rows={data?.data} onRowClick={setOpen}
          empty={<EmptyState icon={Store} title={tab === 'appeals' ? 'No appeals waiting' : 'No stores in this list'} />}
          columns={[
            { key: 'store_name', label: 'Store', render: (r) => <div><div className="font-medium">{r.store_name}</div><div className="text-xs text-ink-mute">{r.owner?.email}</div></div> },
            { key: 'docs', label: 'Documents', render: (r) => {
              const accepted = r.verifications?.filter((v) => v.status === 'approved').length || 0
              return `${r.verifications?.length || 0} uploaded${accepted ? ` · ${accepted} accepted` : ''}`
            } },
            { key: 'rating', label: 'Rating', render: (r) => r.rating_count ? `${r.rating_avg.toFixed(1)} ★ (${r.rating_count})` : '—' },
            { key: 'rate', label: 'Commission', align: 'right', render: (r) => `${r.effective_commission_rate}%` },
            { key: 'created_at', label: 'Applied', render: (r) => date(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => (
              <span className="flex flex-wrap gap-1"><StatusBadge status={r.status} />{r.appeals?.some((a) => a.status === 'open') && <StatusBadge status="appealed" />}</span>) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
      {open && <SellerPanel key={open.id} seller={open} onClose={() => setOpen(null)} onChanged={(s) => { setOpen(s); reload() }} />}
    </>
  )
}
