import { useState } from 'react'
import { MapPin, Pencil, Trash2 } from 'lucide-react'
import AddressForm from '../../components/AddressForm'
import { Alert, Button, ConfirmDialog, Input, Modal } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'

export function ProfileForm() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function save(e) {
    e.preventDefault()
    setSaving(true); setErrors({})
    try {
      const { data } = await api.patch('/auth/me', form)
      setUser(data)
      toast('Profile saved')
    } catch (err) { setErrors(fieldErrors(err)) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
      <Input label="Mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
      <Input label="Email" value={user.email} disabled hint="Contact support to change your email." />
      <div className="flex items-end justify-end"><Button type="submit" loading={saving}>Save profile</Button></div>
    </form>
  )
}

export function PasswordForm() {
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function save(e) {
    e.preventDefault()
    setSaving(true); setErrors({}); setError(null)
    try {
      await api.put('/auth/password', form)
      setForm({ current_password: '', password: '', password_confirmation: '' })
      toast('Password updated. Other devices were signed out.')
    } catch (err) {
      setErrors(fieldErrors(err))
      if (!err.response?.data?.errors) setError(errorMessage(err))
    } finally { setSaving(false) }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
      {error && <div className="sm:col-span-3"><Alert>{error}</Alert></div>}
      <Input type="password" label="Current password" value={form.current_password} onChange={set('current_password')} error={errors.current_password} autoComplete="current-password" />
      <Input type="password" label="New password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" hint="8+ characters with letters and numbers" />
      <Input type="password" label="Confirm new password" value={form.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" />
      <div className="flex justify-end sm:col-span-3"><Button type="submit" variant="outline" loading={saving}>Change password</Button></div>
    </form>
  )
}

export default function Account() {
  const addresses = useFetch('/addresses')
  const [editing, setEditing] = useState(null) // address object or {} for new
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function remove() {
    setBusy(true)
    try {
      await api.delete(`/addresses/${deleting.id}`)
      toast('Address deleted')
      setDeleting(null)
      addresses.reload()
    } catch (e) { toast(errorMessage(e), 'error') } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Account</h1>

      <section className="card p-6"><h2 className="mb-4 text-xl font-bold">Profile</h2><ProfileForm /></section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Addresses</h2>
          <Button size="sm" onClick={() => setEditing({})}>Add address</Button>
        </div>
        {addresses.data?.data.length === 0 && <p className="text-ink-soft">No saved addresses yet. Add one to speed up checkout.</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.data?.data.map((a) => (
            <li key={a.id} className="rounded-xl border border-line p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-sphere" /> {a.label}{a.is_default && <span className="rounded-full bg-sphere-tint px-2 text-xs text-sphere-dark">Default</span>}</div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(a)} className="rounded p-1 text-ink-mute hover:text-ink" aria-label="Edit address"><Pencil className="size-4" /></button>
                  <button onClick={() => setDeleting(a)} className="rounded p-1 text-ink-mute hover:text-coral" aria-label="Delete address"><Trash2 className="size-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-ink-soft">{a.recipient_name} · {a.phone}<br />{a.line1}{a.barangay && `, ${a.barangay}`}<br />{a.city}, {a.province} {a.postal_code}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6"><h2 className="mb-4 text-xl font-bold">Password</h2><PasswordForm /></section>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit address' : 'New address'} size="lg">
        {editing && <AddressForm address={editing.id ? editing : undefined} onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); addresses.reload(); toast('Address saved') }} />}
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy}
        title="Delete this address?" tone="danger" confirmLabel="Delete address" message="Past orders keep their delivery details." />
    </div>
  )
}
