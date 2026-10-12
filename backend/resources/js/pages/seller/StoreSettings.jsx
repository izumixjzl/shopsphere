import { useEffect, useState } from 'react'
import { FileCheck2, Upload } from 'lucide-react'
import { Alert, Button, Input, PageLoader, Select, StatusBadge, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { date, humanize } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { PasswordForm } from '../account/Account'

function Verification({ profile, onUploaded }) {
  const [type, setType] = useState('business_permit')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()

  async function upload(e) {
    e.preventDefault()
    if (!file) return setError('Choose a file to upload.')
    setSaving(true); setError(null)
    const body = new FormData()
    body.append('document_type', type)
    body.append('document', file)
    try {
      await api.post('/seller/store/verifications', body)
      toast('Document uploaded for review')
      setFile(null)
      onUploaded()
    } catch (err) { setError(Object.values(fieldErrors(err))[0] || errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold">Verification documents</h2>
      <p className="mt-1 text-sm text-ink-soft">Upload a business permit, DTI/SEC registration, or a valid ID. Only marketplace admins can see these files.</p>
      {profile.verifications?.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {profile.verifications.map((v) => (
            <li key={v.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2"><FileCheck2 className="size-4 text-ink-mute" /> {humanize(v.document_type)} · {date(v.created_at)}</span>
              <StatusBadge status={v.status} />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={upload} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Select label="Document type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="business_permit">Business permit</option><option value="dti">DTI registration</option>
          <option value="sec">SEC registration</option><option value="bir">BIR certificate</option><option value="valid_id">Valid ID</option>
        </Select>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">File (PDF, JPG, PNG · max 5 MB)</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files[0])} className="field py-2 file:mr-3 file:rounded-full file:border-0 file:bg-sphere-tint file:px-3 file:py-1 file:text-sm file:font-semibold file:text-sphere-dark" />
        </label>
        <Button type="submit" loading={saving}><Upload className="size-4" /> Upload</Button>
      </form>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
    </section>
  )
}

export default function StoreSettings() {
  const { data, loading, reload } = useFetch('/seller/store')
  const { refresh } = useAuth()
  const [form, setForm] = useState(null)
  const [logo, setLogo] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (data) setForm({ store_name: data.store_name, description: data.description || '', contact_email: data.contact_email || '', contact_phone: data.contact_phone || '', business_address: data.business_address || '' })
  }, [data])

  if (loading || !form) return <PageLoader />
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setSaving(true); setErrors({})
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => body.append(k, v ?? ''))
    if (logo) body.append('logo', logo)
    try {
      await api.post('/seller/store', body)
      toast('Store settings saved')
      setLogo(null)
      reload(); refresh()
    } catch (err) { setErrors(fieldErrors(err)) } finally { setSaving(false) }
  }

  return (
    <>
      <PageHeader title="Store settings" description={<>Status: <StatusBadge status={data.status} /> · Commission {data.effective_commission_rate}%</>} />
      <div className="space-y-5">
        <form onSubmit={save} className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="text-lg font-bold sm:col-span-2">Storefront</h2>
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="grid size-16 place-items-center overflow-hidden rounded-full bg-sphere font-display text-2xl font-bold text-white">
              {logo ? <img src={URL.createObjectURL(logo)} alt="" className="size-full object-cover" /> : data.logo_url ? <img src={data.logo_url} alt="" className="size-full object-cover" /> : data.store_name[0]}
            </div>
            <label className="cursor-pointer text-sm font-semibold text-sphere hover:underline">
              Change logo<input type="file" accept="image/*" className="sr-only" onChange={(e) => setLogo(e.target.files[0])} />
            </label>
            {errors.logo && <span className="text-sm text-coral">{errors.logo}</span>}
          </div>
          <Input label="Store name" value={form.store_name} onChange={set('store_name')} error={errors.store_name} />
          <Input label="Business address" value={form.business_address} onChange={set('business_address')} error={errors.business_address} />
          <Input label="Contact email" type="email" value={form.contact_email} onChange={set('contact_email')} error={errors.contact_email} />
          <Input label="Contact phone" value={form.contact_phone} onChange={set('contact_phone')} error={errors.contact_phone} />
          <Textarea className="sm:col-span-2" label="About your store" value={form.description} onChange={set('description')} error={errors.description} />
          <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={saving}>Save settings</Button></div>
        </form>
        <Verification profile={data} onUploaded={() => { reload(); refresh() }} />
        <section className="card p-6"><h2 className="mb-4 text-lg font-bold">Password</h2><PasswordForm /></section>
      </div>
    </>
  )
}
