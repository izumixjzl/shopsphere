import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Clock, Scale, XCircle } from 'lucide-react'
import { Alert, Button, StatusBadge, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { useToast } from '../../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { dateTime } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

function Step({ done, children }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="size-4 text-leaf" /> : <Circle className="size-4 text-ink-mute" />}
      <span className={done ? 'text-ink' : 'text-ink-soft'}>{children}</span>
    </li>
  )
}

function Appeals({ profile, onFiled }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const appeals = profile.appeals || []
  const open = appeals.some((a) => a.status === 'open')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await api.post('/seller/appeals', { message })
      toast('Appeal sent to the marketplace team')
      setMessage('')
      onFiled()
    } catch (err) { setError(fieldErrors(err).message || errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <div className="mt-6 text-left">
      {!open && (
        <form onSubmit={submit} className="grid gap-3">
          <Textarea label="Appeal this suspension" value={message} onChange={(e) => setMessage(e.target.value)} error={error}
            hint="Explain what happened and what you've changed. An administrator reads every appeal." />
          <div className="flex justify-end"><Button type="submit" loading={saving}><Scale className="size-4" /> Send appeal</Button></div>
        </form>
      )}
      {open && <Alert tone="info">Your appeal is under review. We'll notify you as soon as an administrator decides.</Alert>}

      {appeals.length > 0 && (
        <>
          <h2 className="mt-6 font-sans text-sm font-semibold tracking-normal">Appeal history</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
            {appeals.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-mute">{dateTime(a.created_at)}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1 whitespace-pre-line">{a.message}</p>
                {a.admin_note && <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-ink-soft">Admin: {a.admin_note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Shown instead of selling tools until an admin approves (or reinstates) the store. */
export default function SellerPending() {
  const { user, refresh } = useAuth()
  const { received } = useNotifications()
  const { data: store, reload } = useFetch('/seller/store')
  const p = store || user?.seller_profile
  const rejected = p?.status === 'rejected'
  const suspended = p?.status === 'suspended'

  // An approval or appeal decision arrives as a notification; pick up the new status right away.
  useEffect(() => { if (received) { reload(); refresh() } }, [received, reload, refresh])

  const docs = store?.verifications || []

  return (
    <div className="card mx-auto mt-6 max-w-xl p-8 text-center">
      <div className={`mx-auto grid size-14 place-items-center rounded-full ${rejected || suspended ? 'bg-coral-tint text-coral' : 'bg-mango-tint text-[#8a5a00]'}`}>
        {rejected || suspended ? <XCircle className="size-6" /> : <Clock className="size-6" />}
      </div>
      <h1 className="mt-4 text-2xl font-bold">
        {rejected ? 'Your application needs changes' : suspended ? 'Your store is suspended' : `${p?.store_name} is under review`}
      </h1>
      <p className="mt-2 text-ink-soft">
        {rejected && `Reason: ${p?.rejection_reason || 'not given'}. Update your store details or upload new documents to apply again.`}
        {suspended && `Reason: ${p?.rejection_reason || 'not given'}. Your listings are hidden from the shop while the suspension lasts.`}
        {!rejected && !suspended && 'An administrator checks every new store before it can sell. You will get a notification when you are approved.'}
      </p>

      {!suspended && store && (
        <ul className="mx-auto mt-6 w-fit space-y-2 text-left">
          <Step done={Boolean(store.description && store.business_address)}>Store details filled in</Step>
          <Step done={docs.length > 0}>Verification document uploaded</Step>
          <Step done={store.has_accepted_document}>Document accepted by an administrator</Step>
          <Step done={false}>Store approved</Step>
        </ul>
      )}

      {suspended && store ? <Appeals profile={store} onFiled={reload} />
        : <Button className="mt-6" to="/seller/store">{docs.length ? 'Review store details' : 'Upload a document'}</Button>}
    </div>
  )
}
