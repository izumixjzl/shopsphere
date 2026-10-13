import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flag, Heart, Minus, PackageX, Plus, ShieldCheck, Store, Truck } from 'lucide-react'
import ProductCard from '../../components/ProductCard'
import { Button, EmptyState, Modal, PageLoader, Pagination, Select, Stars, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { date, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

function Reviews({ slug, product, breakdown }) {
  const [page, setPage] = useState(1)
  const { data } = useFetch(`/products/${slug}/reviews`, { page })
  const total = product.rating_count

  return (
    <section className="mt-16 grid gap-10 border-t border-line pt-10 md:grid-cols-[260px_1fr]">
      <div>
        <h2 className="text-2xl font-bold">Reviews</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-display text-5xl font-extrabold">{Number(product.rating_avg).toFixed(1)}</span>
          <div><Stars value={product.rating_avg} /><div className="text-sm text-ink-mute">{total} verified {total === 1 ? 'review' : 'reviews'}</div></div>
        </div>
        <ul className="mt-5 space-y-1.5">
          {Object.entries(breakdown).sort((a, b) => b[0] - a[0]).map(([star, count]) => (
            <li key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-ink-soft">{star}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-mango" style={{ width: total ? `${(count / total) * 100}%` : 0 }} />
              </div>
              <span className="w-6 text-right text-ink-mute">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {data?.data.length === 0 && <p className="text-ink-soft">No reviews yet. Customers can review this product after it's delivered.</p>}
        <ul className="divide-y divide-line">
          {data?.data.map((r) => (
            <li key={r.id} className="py-5 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <Stars value={r.rating} />
                <span className="text-xs text-ink-mute">{date(r.created_at)}</span>
              </div>
              {r.title && <h3 className="mt-2 font-sans text-base font-semibold tracking-normal">{r.title}</h3>}
              {r.body && <p className="mt-1 text-ink-soft">{r.body}</p>}
              <p className="mt-2 text-xs text-ink-mute">{r.author} · Verified purchase</p>
            </li>
          ))}
        </ul>
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
    </section>
  )
}

const REPORT_REASONS = [
  ['counterfeit', 'Counterfeit or fake item'],
  ['prohibited', 'Prohibited or illegal item'],
  ['misleading', 'Misleading description or photos'],
  ['offensive', 'Offensive content'],
  ['scam', 'Suspected scam'],
  ['other', 'Something else'],
]

function ReportModal({ product, onClose }) {
  const [reason, setReason] = useState('counterfeit')
  const [details, setDetails] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function submit() {
    setSaving(true); setErrors({})
    try {
      const { data } = await api.post(`/products/${product.id}/reports`, { reason, details: details || null })
      toast(data.message)
      onClose()
    } catch (e) {
      const fe = fieldErrors(e)
      setErrors(Object.keys(fe).length ? fe : { details: errorMessage(e) })
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Report this listing"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={saving} onClick={submit}>Send report</Button></>}>
      <div className="grid gap-4">
        <p className="text-sm text-ink-soft">Tell us what's wrong with “{product.name}”. Our team reviews every report; the seller won't see who sent it.</p>
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason}>
          {REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Textarea label="Details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} error={errors.details}
          hint={reason === 'other' ? 'Required. Describe the problem.' : 'Optional, but helps us act faster.'} />
      </div>
    </Modal>
  )
}

export default function ProductDetail() {
  const { slug } = useParams()
  const { data, loading, error } = useFetch(`/products/${slug}`)
  const { user } = useAuth()
  const { add, wishlist, toggleWishlist, enabled } = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [busy, setBusy] = useState(null)
  const [reporting, setReporting] = useState(false)

  if (loading) return <PageLoader />
  if (error || !data) {
    return <EmptyState icon={PackageX} title="This product isn't available" action={<Button to="/shop">Back to shop</Button>}>It may have been removed by the seller.</EmptyState>
  }

  const { product: p, rating_breakdown: breakdown, related } = data
  const images = p.images?.length ? p.images : [{ id: 0, url: p.image_url }]
  const onSale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
  const maxQty = Math.min(p.stock ?? 0, 99)

  async function addToCart(goToCart) {
    if (!user) return navigate('/login', { state: { from: `/products/${slug}` } })
    if (!enabled) return toast('Switch to a customer account to shop.', 'error')
    setBusy(goToCart ? 'buy' : 'add')
    try {
      await add(p.id, qty)
      if (goToCart) navigate('/cart')
      else toast(`Added ${qty} × ${p.name} to your cart`)
    } catch (e) {
      toast(Object.values(fieldErrors(e))[0] || errorMessage(e), 'error')
    } finally { setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-ink-mute" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-ink">Shop</Link>
        {p.category && <> / <Link to={`/shop?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link></>}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-[20px] bg-white">
            <img src={images[activeImg]?.url} alt={p.name} className="size-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)} aria-label={`Show photo ${i + 1}`}
                  className={`size-20 overflow-hidden rounded-xl border-2 ${i === activeImg ? 'border-sphere' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={img.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Link to={`/stores/${p.seller?.store_slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-sphere hover:underline">
            <Store className="size-4" /> {p.seller?.store_name}
            {p.seller?.rating_count > 0 && <span className="font-normal text-ink-mute">· {p.seller.rating_avg.toFixed(1)} ★ seller rating ({p.seller.rating_count})</span>}
          </Link>
          <h1 className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-bold">{p.name}</h1>
          {p.rating_count > 0 && (
            <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm text-ink-soft"><Stars value={p.rating_avg} /> {Number(p.rating_avg).toFixed(1)} · {p.rating_count} reviews · {p.sales_count} sold</a>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-4xl font-extrabold">{money(p.price)}</span>
            {onSale && <>
              <span className="text-lg text-ink-mute line-through">{money(p.compare_at_price)}</span>
              <span className="rounded-full bg-mango px-2.5 py-0.5 text-sm font-bold">−{Math.round((1 - p.price / p.compare_at_price) * 100)}%</span>
            </>}
          </div>

          {p.short_description && <p className="mt-4 max-w-prose text-ink-soft">{p.short_description}</p>}

          <div className="mt-6 text-sm">
            {p.stock > 0
              ? <span className={p.is_low_stock ? 'font-semibold text-[#8a5a00]' : 'text-leaf'}>{p.is_low_stock ? `Only ${p.stock} left` : 'In stock'}</span>
              : <span className="font-semibold text-coral">Sold out</span>}
            <span className="text-ink-mute"> · SKU {p.sku}</span>
          </div>

          {p.stock > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center rounded-full border border-line bg-white">
                <button className="grid size-12 place-items-center text-ink-soft disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus className="size-4" /></button>
                <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
                <button className="grid size-12 place-items-center text-ink-soft disabled:opacity-30" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity"><Plus className="size-4" /></button>
              </div>
              <Button size="lg" variant="outline" loading={busy === 'add'} onClick={() => addToCart(false)}>Add to cart</Button>
              <Button size="lg" loading={busy === 'buy'} onClick={() => addToCart(true)}>Buy now</Button>
              <button onClick={async () => {
                if (!user) return navigate('/login')
                if (!enabled) return
                const added = await toggleWishlist(p.id)
                toast(added ? 'Saved to your wishlist' : 'Removed from your wishlist')
              }} aria-label="Save to wishlist" aria-pressed={wishlist.has(p.id)}
                className="grid size-12 place-items-center rounded-full border border-line bg-white text-ink-soft hover:text-coral">
                <Heart className={`size-5 ${wishlist.has(p.id) ? 'fill-coral text-coral' : ''}`} />
              </button>
            </div>
          )}

          <ul className="mt-8 space-y-3 rounded-[var(--radius-card)] bg-white p-5 text-sm">
            <li className="flex gap-3"><Truck className="size-5 shrink-0 text-sphere" /> Ships from {p.seller?.store_name}. Flat shipping per store at checkout.</li>
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-sphere" /> Pay cash on delivery. Return within 7 days of delivery.</li>
          </ul>

          {/* Shoppers (or guests, who sign in first) can flag a listing for admin review. */}
          {(!user || enabled) && (
            <button onClick={() => (user ? setReporting(true) : navigate('/login', { state: { from: `/products/${slug}` } }))}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-coral">
              <Flag className="size-4" /> Report this listing
            </button>
          )}
          {reporting && <ReportModal product={p} onClose={() => setReporting(false)} />}

          {p.description && (
            <div className="prose-product mt-8 max-w-prose text-ink-soft">
              <h2 className="mb-3 text-xl font-bold text-ink">Details</h2>
              {/* Description is plain text from the seller; render paragraphs safely. */}
              {p.description.replace(/<[^>]+>/g, '\n').split(/\n+/).filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </div>
      </div>

      <div id="reviews"><Reviews slug={slug} product={p} breakdown={breakdown} /></div>

      {related?.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold">More in {p.category?.name}</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.slice(0, 4).map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </div>
  )
}
