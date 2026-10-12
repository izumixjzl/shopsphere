import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, Pagination, StatusBadge, Table, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { date, humanize, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

const TABS = [['requested', 'Needs a decision'], ['approved', 'Approved, to refund'], ['refunded', 'Refunded'], ['rejected', 'Rejected'], ['', 'All']]

export default function AdminRefunds() {
  const [status, setStatus] = useState('requested')
  const [page, setPage] = useState(1)
  const { data, loading, reload } = useFetch('/admin/refunds', { status: status || undefined, page })
  const [action, setAction] = useState(null) // { refund, kind: approved|rejected|refunded }
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function run() {
    setBusy(true)
    try {
      const { refund, kind } = action
      kind === 'refunded'
        ? await api.post(`/admin/refunds/${refund.id}/refunded`)
        : await api.post(`/admin/refunds/${refund.id}/decide`, { decision: kind, resolution_note: note || null })
      toast(kind === 'refunded' ? 'Refund recorded' : `Request ${kind}`)
      setAction(null); setNote('')
      reload()
    } catch (e) { toast(Object.values(fieldErrors(e))[0] || errorMessage(e), 'error') } finally { setBusy(false) }
  }

  const labels = { approved: 'Approve request', rejected: 'Reject request', refunded: 'Record refund' }

  return (
    <>
      <PageHeader title="Returns & disputes" description="Customer requests filed within 7 days of delivery." />
      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
          {TABS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1) }}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${status === v ? 'border-sphere text-sphere' : 'border-transparent text-ink-soft hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <Table loading={loading} rows={data?.data} empty={<EmptyState icon={LifeBuoy} title="Nothing to review">New return and dispute requests appear here.</EmptyState>}
          columns={[
            { key: 'order', label: 'Order', render: (r) => <Link to={`/admin/orders/${r.order_id}`} className="font-medium hover:text-sphere">{r.order?.order_number}</Link> },
            { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
            { key: 'item', label: 'Item', render: (r) => r.order_item?.product_name },
            { key: 'type', label: 'Request', render: (r) => <div><div className="font-medium">{humanize(r.type)}</div><div className="max-w-xs text-xs text-ink-mute">{r.reason}{r.details && ` — ${r.details}`}</div></div> },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
            { key: 'created_at', label: 'Filed', render: (r) => date(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'a', label: '', align: 'right', render: (r) => (
              <div className="flex justify-end gap-1">
                {r.status === 'requested' && <>
                  <Button size="sm" variant="outline" onClick={() => setAction({ refund: r, kind: 'approved' })}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAction({ refund: r, kind: 'rejected' })}>Reject</Button>
                </>}
                {r.status === 'approved' && <Button size="sm" onClick={() => setAction({ refund: r, kind: 'refunded' })}>Record refund</Button>}
              </div>) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data && { current_page: data.current_page, last_page: data.last_page, total: data.total }} onPage={setPage} /></div>
      </div>
      <ConfirmDialog open={Boolean(action)} onClose={() => setAction(null)} onConfirm={run} loading={busy}
        tone={action?.kind === 'rejected' ? 'danger' : 'primary'} title={labels[action?.kind] ? `${labels[action.kind]}?` : ''} confirmLabel={labels[action?.kind]}
        message={action?.kind === 'refunded'
          ? `Records a ${money(action.refund.amount)} refund to the customer${action.refund.type === 'return' ? ' and puts the returned item back in stock' : ''}. Payment gateways come later, so send the money manually.`
          : 'The customer and seller are notified.'}>
        {action && action.kind !== 'refunded' && <div className="mt-3"><Textarea label="Note to the customer" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
      </ConfirmDialog>
    </>
  )
}
