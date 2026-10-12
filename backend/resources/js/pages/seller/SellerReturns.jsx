import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import Evidence from '../../components/Evidence'
import { Button, ConfirmDialog, EmptyState, Pagination, StatusBadge, Table, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { date, humanize, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

const TABS = [['requested', 'Needs a decision'], ['approved', 'Approved to refund'], ['refunded', 'Refunded'], ['rejected', 'Rejected'], ['', 'All']]
const LABELS = { approved: 'Approve request', rejected: 'Reject request', refunded: 'Record refund' }

export default function SellerReturns() {
  const [status, setStatus] = useState('requested')
  const [page, setPage] = useState(1)
  const { data, loading, reload } = useFetch('/seller/refunds', { status: status || undefined, page })
  const [action, setAction] = useState(null) // { refund, kind: approved|rejected|refunded }
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function open(refund, kind) { setAction({ refund, kind }); setNote(''); setError(null) }

  async function run() {
    const { refund, kind } = action
    if (kind === 'rejected' && !note.trim()) return setError('Tell the customer why the request was rejected.')
    setBusy(true); setError(null)
    try {
      kind === 'refunded'
        ? await api.post(`/seller/refunds/${refund.id}/refunded`)
        : await api.post(`/seller/refunds/${refund.id}/decide`, { decision: kind, resolution_note: note || null })
      toast(kind === 'refunded' ? 'Refund recorded' : `Request ${kind}`)
      setAction(null)
      reload()
    } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setBusy(false) }
  }

  const r = action?.refund

  return (
    <>
      <PageHeader title="Returns & disputes"
        description="Requests customers filed on your orders, with their proof. Review each one: your decision is final and the customer is notified." />
      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
          {TABS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1) }}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${status === v ? 'border-sphere text-sphere' : 'border-transparent text-ink-soft hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <Table loading={loading} rows={data?.data}
          empty={<EmptyState icon={LifeBuoy} title="Nothing here">When a customer asks to return an item or reports a problem, it shows up here.</EmptyState>}
          columns={[
            { key: 'order', label: 'Order', render: (x) => <Link to={`/seller/orders/${x.seller_order_id}`} className="font-medium hover:text-sphere">{x.seller_order?.reference}</Link> },
            { key: 'item', label: 'Item', render: (x) => <div><div className="font-medium">{x.order_item?.product_name}</div><div className="text-xs text-ink-mute">{x.customer?.name}</div></div> },
            { key: 'type', label: 'Request', render: (x) => <div><div className="font-medium">{humanize(x.type)}</div><div className="max-w-xs text-xs text-ink-mute">{x.reason}{x.details && ` — ${x.details}`}</div></div> },
            { key: 'evidence', label: 'Proof', render: (x) => <Evidence refund={x} /> },
            { key: 'amount', label: 'Amount', align: 'right', render: (x) => money(x.amount) },
            { key: 'created_at', label: 'Filed', render: (x) => date(x.created_at) },
            { key: 'status', label: 'Status', render: (x) => (
              <div><StatusBadge status={x.status} />{x.resolution_note && <div className="mt-1 max-w-48 text-xs text-ink-mute">{x.resolution_note}</div>}</div>) },
            { key: 'a', label: '', align: 'right', render: (x) => (
              <div className="flex justify-end gap-1">
                {x.status === 'requested' && <>
                  <Button size="sm" variant="outline" onClick={() => open(x, 'approved')}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => open(x, 'rejected')}>Reject</Button>
                </>}
                {x.status === 'approved' && <Button size="sm" onClick={() => open(x, 'refunded')}>Record refund</Button>}
              </div>) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data && { current_page: data.current_page, last_page: data.last_page, total: data.total }} onPage={setPage} /></div>
      </div>

      <ConfirmDialog open={Boolean(action)} onClose={() => setAction(null)} onConfirm={run} loading={busy}
        tone={action?.kind === 'rejected' ? 'danger' : 'primary'} title={action ? `${LABELS[action.kind]}?` : ''} confirmLabel={LABELS[action?.kind]}
        message={!r ? null : action.kind === 'refunded'
          ? `Confirm you've sent ${money(r.amount)} to ${r.customer?.name ?? 'the customer'}.${r.type === 'return' ? ' The returned item goes back into your stock.' : ''}`
          : action.kind === 'approved'
            ? `The customer is told their ${r.type} was approved. Next, send the ${money(r.amount)} refund and record it here.`
            : 'The customer is notified with your reason. This decision is final.'}>
        {action && action.kind !== 'refunded' && (
          <div className="mt-3">
            <Textarea label={action.kind === 'rejected' ? 'Reason for the customer (required)' : 'Note to the customer (optional)'}
              value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} error={error}
              placeholder={action.kind === 'approved' ? 'e.g. Please ship the item back to our store address.' : 'e.g. The photos show no damage to the item.'} />
          </div>
        )}
        {action?.kind === 'refunded' && error && <p className="mt-3 text-sm text-coral">{error}</p>}
      </ConfirmDialog>
    </>
  )
}
