import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Film, ImagePlus, Store, X } from 'lucide-react'
import ShipmentTimeline from '../../components/ShipmentTimeline'
import { Alert, Button, ConfirmDialog, Input, Modal, PageLoader, Select, StatusBadge, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { dateTime, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

function ReviewModal({ item, onClose, onDone }) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()

  async function submit() {
    setSaving(true); setError(null)
    try {
      await api.post(`/order-items/${item.id}/review`, { rating, title: title || null, body: body || null })
      toast('Review posted')
      onDone()
    } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Review ${item.product_name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={submit}>Post review</Button></>}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n}>
                <svg viewBox="0 0 20 20" className={`size-8 ${n <= rating ? 'text-mango' : 'text-line'}`} fill="currentColor"><path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" /></svg>
              </button>
            ))}
          </div>
        </fieldset>
        <Input label="Headline (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Textarea label="What did you think? (optional)" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      </div>
    </Modal>
  )
}

// Keep in sync with config/marketplace.php.
const MAX_FILES = 5
const MAX_MB = 20
const PROOF_REQUIRED = ['Item arrived damaged', 'Wrong item received']

/** Photo/video picker with previews. `files` = [{ file, url }]. */
function EvidencePicker({ files, setFiles, required, onError }) {
  const inputRef = useRef(null)
  const latest = useRef(files)
  latest.current = files

  // Free the preview blobs when the dialog closes.
  useEffect(() => () => latest.current.forEach((f) => URL.revokeObjectURL(f.url)), [])

  function add(list) {
    const picked = [...list]
    const tooBig = picked.filter((f) => f.size > MAX_MB * 1024 * 1024)
    const ok = picked.filter((f) => f.size <= MAX_MB * 1024 * 1024 && /^(image|video)\//.test(f.type))
    const room = MAX_FILES - files.length
    onError(tooBig.length ? `${tooBig.map((f) => f.name).join(', ')} is over ${MAX_MB} MB.`
      : ok.length > room ? `You can attach up to ${MAX_FILES} files.` : null)
    setFiles([...files, ...ok.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))])
    inputRef.current.value = ''
  }

  function remove(i) {
    URL.revokeObjectURL(files[i].url)
    setFiles(files.filter((_, j) => j !== i))
  }

  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">Photos or videos {required ? <span className="text-coral">(required)</span> : <span className="font-normal text-ink-mute">(optional)</span>}</div>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={f.url} className="relative size-20 overflow-hidden rounded-xl bg-paper">
            {f.file.type.startsWith('video/')
              ? <><video src={f.url} muted preload="metadata" className="size-full object-cover" /><Film className="absolute bottom-1 left-1 size-4 text-white drop-shadow" /></>
              : <img src={f.url} alt={f.file.name} className="size-full object-cover" />}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${f.file.name}`}
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink"><X className="size-3.5" /></button>
          </div>
        ))}
        {files.length < MAX_FILES && (
          <button type="button" onClick={() => inputRef.current.click()}
            className="grid size-20 place-items-center rounded-xl border-2 border-dashed border-line text-ink-mute hover:border-sphere hover:text-sphere">
            <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" /> Add</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="hidden"
        onChange={(e) => add(e.target.files)} />
      <p className="mt-1.5 text-xs text-ink-mute">Show the damage or the item you received. Up to {MAX_FILES} files, {MAX_MB} MB each.</p>
    </div>
  )
}

function ReturnModal({ item, onClose, onDone }) {
  const [form, setForm] = useState({ type: 'return', reason: 'Item arrived damaged', details: '' })
  const [files, setFiles] = useState([])
  const [progress, setProgress] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()
  const proofRequired = PROOF_REQUIRED.includes(form.reason)

  async function submit() {
    if (proofRequired && !files.length) return setError('Please attach at least one photo or video showing the problem.')
    setSaving(true); setError(null)
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => body.append(k, v))
    files.forEach((f) => body.append('evidence[]', f.file))
    try {
      await api.post(`/order-items/${item.id}/refunds`, body, {
        onUploadProgress: (e) => files.length && e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      })
      toast('Request sent. We will update you by notification.')
      onDone()
    } catch (e) {
      setError(e.response?.status === 413 ? 'Your files are too large to upload. Try fewer or smaller files.' : Object.values(fieldErrors(e))[0] || errorMessage(e))
    } finally { setSaving(false); setProgress(null) }
  }

  return (
    <Modal open onClose={onClose} title="Return or report a problem"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={submit}>{progress !== null && progress < 100 ? `Uploading ${progress}%` : 'Send request'}</Button></>}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-ink-soft">{item.quantity} × {item.product_name} · {money(item.line_total)}</p>
        <Select label="What would you like?" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="return">Return the item for a refund</option>
          <option value="refund">Refund without returning</option>
          <option value="dispute">Report a problem with the seller</option>
        </Select>
        <Select label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          {['Item arrived damaged', 'Wrong item received', 'Item not as described', 'Missing parts', 'Changed my mind'].map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Textarea label="Details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Tell us what happened" />
        <EvidencePicker files={files} setFiles={setFiles} required={proofRequired} onError={setError} />
      </div>
    </Modal>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const { data: o, loading, error, reload, setData } = useFetch(`/orders/${id}`)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reviewItem, setReviewItem] = useState(null)
  const [returnItem, setReturnItem] = useState(null)
  const { data: refunds } = useFetch('/refunds')
  const navigate = useNavigate()
  // An item with an open request can't get a second one; show its status instead.
  const openRequest = (itemId) => refunds?.data.find((r) => r.order_item_id === itemId && ['requested', 'approved'].includes(r.status))
  const toast = useToast()

  if (loading) return <PageLoader />
  if (error) return <div className="mx-auto max-w-4xl p-6"><Alert>{error}</Alert></div>

  async function cancel() {
    setCancelling(true)
    try {
      const { data } = await api.post(`/orders/${id}/cancel`, { reason: 'Cancelled by customer' })
      setData(data)
      toast('Order cancelled')
      setConfirmCancel(false)
    } catch (e) { toast(Object.values(fieldErrors(e))[0] || errorMessage(e), 'error') } finally { setCancelling(false) }
  }

  const addr = o.shipping_address

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {state?.justPlaced && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] bg-leaf-tint p-5 text-leaf">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div><div className="font-semibold">Thanks! Your order is in.</div><div className="text-sm text-ink-soft">Each store will confirm and ship its part. Prepare {money(o.grand_total)} in cash for the couriers.</div></div>
        </div>
      )}

      <Link to="/account/orders" className="text-sm text-ink-mute hover:text-ink">My orders</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Order {o.order_number}</h1>
          <p className="text-sm text-ink-mute">Placed {dateTime(o.placed_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={o.status} />
          {o.can_cancel && <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>Cancel order</Button>}
        </div>
      </div>

      <div className="mt-8 space-y-5">
        {o.seller_orders.map((so) => (
          <section key={so.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <Link to={`/stores/${so.seller?.store_slug}`} className="flex items-center gap-2 font-semibold hover:text-sphere"><Store className="size-4" /> {so.seller?.store_name}</Link>
              <div className="flex items-center gap-2 text-sm text-ink-mute">{so.reference} <StatusBadge status={so.status} /></div>
            </header>
            <div className="px-5 py-5"><ShipmentTimeline sellerOrder={so} /></div>
            <ul className="divide-y divide-line border-t border-line">
              {so.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-paper">{i.product_image_url && <img src={i.product_image_url} alt="" className="size-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{i.product_name}</div>
                    <div className="text-sm text-ink-mute">{i.quantity} × {money(i.unit_price)}</div>
                  </div>
                  <div className="font-semibold tabular-nums">{money(i.line_total)}</div>
                  {so.status === 'delivered' && (
                    <div className="flex w-full justify-end gap-2 sm:w-auto">
                      {i.reviewed ? <span className="text-sm text-leaf">Reviewed</span> : <Button size="sm" variant="outline" onClick={() => setReviewItem(i)}>Write a review</Button>}
                      {openRequest(i.id)
                        ? <Link to="/account/returns" className="flex items-center gap-2 text-sm font-medium text-sphere hover:underline"><StatusBadge status={openRequest(i.id).status} /> View request</Link>
                        : <Button size="sm" variant="ghost" onClick={() => setReturnItem(i)}>Return / report</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <section className="card p-5 text-sm">
          <h2 className="mb-2 text-base font-bold">Delivery address</h2>
          <p className="text-ink-soft">{addr.recipient_name} · {addr.phone}<br />{addr.line1}{addr.barangay && `, ${addr.barangay}`}<br />{addr.city}, {addr.province} {addr.postal_code}</p>
        </section>
        <section className="card p-5 text-sm">
          <h2 className="mb-2 text-base font-bold">Payment</h2>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd>{money(o.shipping_total)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total (cash on delivery)</dt><dd>{money(o.grand_total)}</dd></div>
            <div className="flex justify-between pt-1"><dt className="text-ink-soft">Payment status</dt><dd><StatusBadge status={o.payment_status} /></dd></div>
          </dl>
        </section>
      </div>

      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={cancel} loading={cancelling}
        title="Cancel this order?" tone="danger" confirmLabel="Cancel order"
        message="All stores in this order will be notified and the items will be released back to stock." />
      {reviewItem && <ReviewModal item={reviewItem} onClose={() => setReviewItem(null)} onDone={() => { setReviewItem(null); reload() }} />}
      {returnItem && <ReturnModal item={returnItem} onClose={() => setReturnItem(null)} onDone={() => navigate('/account/returns')} />}
    </div>
  )
}
