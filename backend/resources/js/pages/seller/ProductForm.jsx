import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { Alert, Button, Input, PageLoader, Select, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'

const EMPTY = { name: '', sku: '', category_id: '', price: '', compare_at_price: '', short_description: '', description: '', status: 'active', stock: 0, low_stock_threshold: 5 }

export default function ProductForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { data: categories } = useFetch('/categories')
  const existing = useFetch(editing ? `/seller/products/${id}` : null)
  const [form, setForm] = useState(EMPTY)
  const [images, setImages] = useState([]) // saved images
  const [files, setFiles] = useState([]) // new File objects
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const p = existing.data
    if (!p) return
    setForm({
      name: p.name, sku: p.sku, category_id: p.category?.id ?? '', price: p.price, compare_at_price: p.compare_at_price ?? '',
      short_description: p.short_description ?? '', description: p.description ?? '', status: p.status, stock: p.stock ?? 0,
      low_stock_threshold: p.low_stock_threshold ?? 5,
    })
    setImages(p.images ?? [])
  }, [existing.data])

  const previews = files.map((f) => ({ file: f, url: URL.createObjectURL(f) }))
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [files]) // eslint-disable-line react-hooks/exhaustive-deps

  if (editing && existing.loading) return <PageLoader />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setErrors({}); setError(null)
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) body.append(k, v) })
    files.forEach((f) => body.append('images[]', f))
    try {
      const url = editing ? `/seller/products/${id}` : '/seller/products'
      const { data } = await api.post(url, body)
      toast(editing ? 'Product saved' : 'Product added')
      if (editing) { setImages(data.images ?? []); setFiles([]) } else navigate(`/seller/products/${data.id}`, { replace: true })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      setError(Object.keys(fe).length ? 'Check the highlighted fields.' : errorMessage(err))
    } finally { setSaving(false) }
  }

  async function imageAction(img, action) {
    try {
      const { data } = action === 'delete'
        ? await api.delete(`/seller/products/${id}/images/${img.id}`)
        : await api.patch(`/seller/products/${id}/images/${img.id}/primary`)
      setImages(data.images ?? [])
    } catch (e) { toast(errorMessage(e), 'error') }
  }

  const imgError = errors.images || Object.entries(errors).find(([k]) => k.startsWith('images.'))?.[1]

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title={editing ? 'Edit product' : 'Add product'} description={editing ? form.name : 'Fill in the details shoppers will see.'}
        actions={<><Button type="button" variant="ghost" onClick={() => navigate('/seller/products')}>Back to products</Button><Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Add product'}</Button></>} />
      {error && <div className="mb-5"><Alert>{error}</Alert></div>}
      {existing.data && existing.data.moderation_status !== 'approved' && (
        <div className="mb-5"><Alert tone="warn">An administrator {existing.data.moderation_status} this listing: {existing.data.moderation_note}</Alert></div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="card space-y-4 p-6">
            <h2 className="text-lg font-bold">Details</h2>
            <Input label="Product name" value={form.name} onChange={set('name')} error={errors.name} required />
            <Input label="Short description" value={form.short_description} onChange={set('short_description')} error={errors.short_description} hint="Shown under the price. One or two sentences." />
            <Textarea label="Full description" rows={7} value={form.description} onChange={set('description')} error={errors.description} />
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Photos</h2>
            <p className="mt-1 text-sm text-ink-mute">Up to 6 photos, JPG, PNG or WebP. The starred photo appears on product cards.</p>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-paper">
                  <img src={img.url} alt="" className="size-full object-cover" />
                  <div className="absolute inset-x-1.5 top-1.5 flex justify-between">
                    <button type="button" onClick={() => imageAction(img, 'primary')} aria-label="Make main photo"
                      className={`grid size-7 place-items-center rounded-full bg-white/95 ${img.is_primary ? 'text-mango' : 'text-ink-mute hover:text-mango'}`}>
                      <Star className={`size-3.5 ${img.is_primary ? 'fill-mango' : ''}`} />
                    </button>
                    <button type="button" onClick={() => imageAction(img, 'delete')} aria-label="Delete photo" className="grid size-7 place-items-center rounded-full bg-white/95 text-ink-mute hover:text-coral"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ))}
              {previews.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-paper ring-2 ring-sphere/40">
                  <img src={p.url} alt="" className="size-full object-cover" />
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-ink-mute hover:text-coral"><Trash2 className="size-3.5" /></button>
                  <span className="absolute inset-x-0 bottom-0 bg-sphere/90 py-0.5 text-center text-[11px] font-semibold text-white">Not saved yet</span>
                </div>
              ))}
              {images.length + files.length < 6 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-mute hover:border-sphere hover:text-sphere">
                  <span className="flex flex-col items-center gap-1 text-sm"><ImagePlus className="size-6" /> Add photos</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
                    onChange={(e) => { setFiles([...files, ...Array.from(e.target.files)].slice(0, 6 - images.length)); e.target.value = '' }} />
                </label>
              )}
            </div>
            {imgError && <p className="mt-2 text-sm text-coral">{imgError}</p>}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card space-y-4 p-6">
            <h2 className="text-lg font-bold">Visibility</h2>
            <Select label="Status" value={form.status} onChange={set('status')} error={errors.status}>
              <option value="active">Active — visible in the shop</option>
              <option value="draft">Draft — only you can see it</option>
              <option value="inactive">Inactive — hidden from the shop</option>
            </Select>
            <Select label="Category" value={form.category_id} onChange={set('category_id')} error={errors.category_id}>
              <option value="">Choose a category</option>
              {categories?.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  <option value={c.id}>{c.name} (general)</option>
                  {c.children?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </section>

          <section className="card grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-1">
            <h2 className="text-lg font-bold sm:col-span-2 xl:col-span-1">Price</h2>
            <Input label="Price (₱)" type="number" min="1" step="0.01" value={form.price} onChange={set('price')} error={errors.price} />
            <Input label="Compare-at price (₱)" type="number" min="0" step="0.01" value={form.compare_at_price} onChange={set('compare_at_price')} error={errors.compare_at_price} hint="Optional. Shows a strike-through sale price." />
          </section>

          <section className="card grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-1">
            <h2 className="text-lg font-bold sm:col-span-2 xl:col-span-1">Inventory</h2>
            <Input label="SKU" value={form.sku} onChange={set('sku')} error={errors.sku} hint="Letters, numbers, dots, dashes. Unique in your store." />
            <Input label="Units in stock" type="number" min="0" value={form.stock} onChange={set('stock')} error={errors.stock} />
            <Input label="Low-stock alert at" type="number" min="0" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} error={errors.low_stock_threshold} />
          </section>
        </div>
      </div>
    </form>
  )
}
