import { useState } from 'react'
import { Alert, Button, ConfirmDialog, Input, Modal, Textarea } from './ui'
import { useToast } from '../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../lib/api'

const LABELS = {
  confirmed: 'Confirm order', packed: 'Mark as packed', shipped: 'Ship order',
  delivered: 'Mark as delivered', cancelled: 'Cancel order', returned: 'Mark as returned',
}

/**
 * Buttons for the next allowed statuses of a seller order.
 * `endpoint` differs for sellers and admins; the server enforces the same rules.
 */
export default function FulfilmentActions({ sellerOrder, endpoint, onUpdated }) {
  const [pending, setPending] = useState(null)
  const [details, setDetails] = useState({ courier: '', tracking_number: '', reason: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const next = sellerOrder.allowed_next || []
  if (!next.length) return null

  async function submit() {
    setSaving(true); setErrors({}); setError(null)
    try {
      const payload = { status: pending, ...Object.fromEntries(Object.entries(details).filter(([, v]) => v)) }
      const { data } = await api.patch(endpoint, payload)
      toast(`Order ${pending === 'cancelled' ? 'cancelled' : `marked ${pending}`}`)
      setPending(null)
      onUpdated(data)
    } catch (e) {
      const fe = fieldErrors(e)
      setErrors(fe)
      setError(fe.status || (!Object.keys(fe).length ? errorMessage(e) : null))
    } finally { setSaving(false) }
  }

  const primary = next.find((s) => s !== 'cancelled' && s !== 'returned')

  return (
    <div className="flex flex-wrap gap-2">
      {primary && <Button onClick={() => setPending(primary)}>{LABELS[primary]}</Button>}
      {next.filter((s) => s !== primary).map((s) => (
        <Button key={s} variant={s === 'cancelled' ? 'outline' : 'ghost'} onClick={() => setPending(s)}>{LABELS[s]}</Button>
      ))}

      <Modal open={pending === 'shipped'} onClose={() => setPending(null)} title="Ship this order" size="sm"
        footer={<><Button variant="ghost" onClick={() => setPending(null)}>Not yet</Button><Button loading={saving} onClick={submit}>Ship order</Button></>}>
        <div className="grid gap-4">
          {error && <Alert>{error}</Alert>}
          <Input label="Courier" placeholder="J&T Express, LBC, Ninja Van…" value={details.courier} onChange={(e) => setDetails({ ...details, courier: e.target.value })} error={errors.courier} />
          <Input label="Tracking number" value={details.tracking_number} onChange={(e) => setDetails({ ...details, tracking_number: e.target.value })} error={errors.tracking_number} hint="The customer sees this on their order page." />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(pending) && pending !== 'shipped'} onClose={() => setPending(null)} onConfirm={submit} loading={saving}
        tone={pending === 'cancelled' ? 'danger' : 'primary'} title={`${LABELS[pending] || ''}?`} confirmLabel={LABELS[pending]}
        message={pending === 'cancelled' ? 'The customer is notified and the items go back into your stock.'
          : pending === 'delivered' ? 'Confirm the courier has delivered the parcel and collected payment.'
          : pending === 'returned' ? 'Items go back into your stock and the commission for this order is reversed.'
          : 'The customer will be notified.'}>
        {pending === 'cancelled' && (
          <div className="mt-4"><Textarea label="Reason" value={details.reason} onChange={(e) => setDetails({ ...details, reason: e.target.value })} placeholder="e.g. Item no longer available" /></div>
        )}
        {error && pending !== 'shipped' && <div className="mt-3"><Alert>{error}</Alert></div>}
      </ConfirmDialog>
    </div>
  )
}
