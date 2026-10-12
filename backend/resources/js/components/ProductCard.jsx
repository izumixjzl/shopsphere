import { Link, useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { money } from '../lib/format'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/api'
import { Stars } from './ui'

export default function ProductCard({ product }) {
  const { user } = useAuth()
  const { wishlist, toggleWishlist, enabled } = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  const saved = wishlist.has(product.id)
  const onSale = product.compare_at_price && Number(product.compare_at_price) > Number(product.price)

  async function onHeart(e) {
    e.preventDefault()
    if (!user) return navigate('/login', { state: { from: `/products/${product.slug}` } })
    if (!enabled) return toast('Wishlists are for customer accounts.', 'error')
    try {
      const added = await toggleWishlist(product.id)
      toast(added ? 'Saved to your wishlist' : 'Removed from your wishlist')
    } catch (err) { toast(errorMessage(err), 'error') }
  }

  return (
    <Link to={`/products/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-white">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <div className="grid size-full place-items-center text-ink-mute">No photo</div>}
        {product.in_stock === false && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/95 py-1 text-center text-xs font-semibold text-coral">Sold out</span>
        )}
        <button onClick={onHeart} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} aria-pressed={saved}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-white/90 text-ink-soft shadow-sm hover:text-coral">
          <Heart className={`size-4 ${saved ? 'fill-coral text-coral' : ''}`} />
        </button>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <span className="text-xs text-ink-mute">{product.seller?.store_name}</span>
        <h3 className="mt-0.5 line-clamp-2 font-sans text-[15px] font-semibold leading-snug tracking-normal group-hover:text-sphere">{product.name}</h3>
        {product.rating_count > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-mute">
            <Stars value={product.rating_avg} size="size-3.5" /> ({product.rating_count})
          </div>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className={`font-display text-lg font-bold ${onSale ? 'text-sphere' : ''}`}>{money(product.price)}</span>
          {onSale && <span className="text-sm text-ink-mute line-through">{money(product.compare_at_price)}</span>}
        </div>
      </div>
    </Link>
  )
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-square rounded-[var(--radius-card)]" />
          <div className="skeleton mt-3 h-3 w-1/3 rounded" />
          <div className="skeleton mt-2 h-4 w-4/5 rounded" />
          <div className="skeleton mt-3 h-5 w-1/4 rounded" />
        </div>
      ))}
    </div>
  )
}
