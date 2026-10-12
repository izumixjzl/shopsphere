import { Heart } from 'lucide-react'
import ProductCard, { ProductGridSkeleton } from '../../components/ProductCard'
import { Button, EmptyState } from '../../components/ui'
import { useCart } from '../../context/CartContext'
import { useFetch } from '../../lib/useFetch'

export default function Wishlist() {
  const { wishlist } = useCart()
  const { data, loading } = useFetch('/wishlist')
  // Hide items the user un-hearts on this page without refetching.
  const items = (data?.data ?? []).filter((p) => wishlist.has(p.id))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Wishlist</h1>
      <div className="mt-8">
        {loading ? <ProductGridSkeleton count={4} /> : items.length === 0 ? (
          <EmptyState icon={Heart} title="Nothing saved yet" action={<Button to="/shop">Browse products</Button>}>Tap the heart on any product to keep it here.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
