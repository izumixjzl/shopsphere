import { useState } from 'react'
import { api, errorMessage, fieldErrors } from '../lib/api'
import { Alert, Button, Input } from './ui'

const EMPTY = { label: 'Home', recipient_name: '', phone: '', line1: '', line2: '', barangay: '', city: '', province: '', postal_code: '', is_default: false }

export default function AddressForm({ address, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...address })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setErrors({}); setError(null)
    try {
      const res = address?.id ? await api.put(`/addresses/${address.id}`, form) : await api.post('/addresses', form)
      onSaved?.(res.data.data)
    } catch (err) {
      setErrors(fieldErrors(err))
      if (!err.response?.data?.errors) setError(errorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <Input label="Full name" value={form.recipient_name} onChange={set('recipient_name')} error={errors.recipient_name} autoComplete="name" required />
      <Input label="Mobile number" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" placeholder="09XX XXX XXXX" required />
      <Input className="sm:col-span-2" label="House no., street, building" value={form.line1} onChange={set('line1')} error={errors.line1} autoComplete="address-line1" required />
      <Input label="Barangay" value={form.barangay || ''} onChange={set('barangay')} error={errors.barangay} />
      <Input label="City / municipality" value={form.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" required />
      <Input label="Province" value={form.province} onChange={set('province')} error={errors.province} autoComplete="address-level1" required />
      <Input label="Postal code" value={form.postal_code} onChange={set('postal_code')} error={errors.postal_code} autoComplete="postal-code" inputMode="numeric" required />
      <Input label="Label" value={form.label || ''} onChange={set('label')} error={errors.label} hint="e.g. Home, Office" />
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" className="size-4 accent-sphere" checked={Boolean(form.is_default)} onChange={set('is_default')} /> Use as default address
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={saving}>Save address</Button>
      </div>
    </form>
  )
}
