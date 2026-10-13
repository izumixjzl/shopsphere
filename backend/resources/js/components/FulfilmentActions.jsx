import { useEffect, useState } from 'react'
import { Alert, Button, ConfirmDialog, Input, Modal, Select, Textarea } from './ui'
import { useToast } from '../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../lib/api'
import { useFetch } from '../lib/useFetch'

const LABELS = {
  confirmed: 'Confirm order', packed: 'Mark as packed', shipped: 'Ship order',
  delivered: 'Mark as delivered', cancelled: 'Cancel order', returned: 'Mark as returned',
}

/**
 * Buttons for the next allowed statuses of a seller order.
 * `endpoint` differs for sellers and admins; the server enforces the same rules.
 */
export default function FulfilmentActions({ sellerOrder, endpoint, onUpdated, awaitingPayment = false, paidOnline = false }) {
  const [pending, setPending] = useState(null)
  const [details, setDetails] = useState({ courier_code: '', courier: '', tracking_number: '', reason: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const couriers = useFetch('/couriers', undefined, { enabled: pending === 'shipped' })

  // Start from the courier this seller used last; most sellers stick to one or two.
  const last = couriers.data?.last
  useEffect(() => {
    if (last) setDetails((d) => (d.courier_code ? d : { ...d, courier_code: last.code, courier: last.code === 'other' ? last.name : '' }))
  }, [last])

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

  // Unpaid online orders can only be cancelled; the server enforces the same rule.
  const primary = awaitingPayment ? null : next.find((s) => s !== 'cancelled' && s !== 'returned')
  const others = next.filter((s) => s !== primary && (!awaitingPayment || s === 'cancelled'))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {awaitingPayment && <span className="rounded-full bg-mango-tint px-3 py-1.5 text-sm font-medium text-[#8a5a00]">Awaiting customer payment</span>}
      {primary && <Button onClick={() => setPending(primary)}>{LABELS[primary]}</Button>}
      {others.map((s) => (
        <Button key={s} variant={s === 'cancelled' ? 'outline' : 'ghost'} onClick={() => setPending(s)}>{LABELS[s]}</Button>
      ))}

      <Modal open={pending === 'shipped'} onClose={() => setPending(null)} title="Ship this order" size="sm"
        footer={<><Button variant="ghost" onClick={() => setPending(null)}>Not yet</Button><Button loading={saving} onClick={submit}>Ship order</Button></>}>
        <div className="grid gap-4">
          {error && <Alert>{error}</Alert>}
          <Select label="Courier" value={details.courier_code} error={details.courier_code !== 'other' ? errors.courier || errors.courier_code : undefined}
            onChange={(e) => setDetails({ ...details, courier_code: e.target.value, courier: '' })}>
            <option value="" disabled>{couriers.loading ? 'Loading couriers…' : 'Choose a courier'}</option>
            {couriers.data?.data.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="other">Other</option>
          </Select>
          {details.courier_code === 'other' && (
            <Input label="Courier name" placeholder="e.g. Entrego" maxLength={60} autoFocus value={details.courier}
              onChange={(e) => setDetails({ ...details, courier: e.target.value })} error={errors.courier} />
          )}
          <Input label="Tracking number" value={details.tracking_number} onChange={(e) => setDetails({ ...details, tracking_number: e.target.value })} error={errors.tracking_number} hint="The customer sees this on their order page." />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(pending) && pending !== 'shipped'} onClose={() => setPending(null)} onConfirm={submit} loading={saving}
        tone={pending === 'cancelled' ? 'danger' : 'primary'} title={`${LABELS[pending] || ''}?`} confirmLabel={LABELS[pending]}
        message={pending === 'cancelled' ? 'The customer is notified and the items go back into your stock.'
          : pending === 'delivered' ? (paidOnline
            ? 'Confirm the courier has delivered the parcel. This order was paid online, so no cash is collected.'
            : 'Confirm the courier has delivered the parcel and collected payment.')
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
