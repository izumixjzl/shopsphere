import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Store } from 'lucide-react'
import ProductCard, { ProductGridSkeleton } from '../../components/ProductCard'
import { Button, EmptyState, PageLoader, Pagination, Select } from '../../components/ui'
import { compact } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

export default function StorePage() {
  const { slug } = useParams()
  const [sort, setSort] = useState('popular')
  const [page, setPage] = useState(1)
  const store = useFetch(`/stores/${slug}`)
  const products = useFetch('/products', { store: slug, sort, page, per_page: 20 })

  if (store.loading) return <PageLoader />
  if (store.error) return <EmptyState icon={Store} title="Store not found" action={<Button to="/shop">Back to shop</Button>}>This store may be closed or under review.</EmptyState>

  const { store: s, stats } = store.data

  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-4 py-10 sm:px-6">
          <div className="grid size-20 place-items-center overflow-hidden rounded-full bg-sphere font-display text-3xl font-extrabold">
            {s.logo_url ? <img src={s.logo_url} alt="" className="size-full object-cover" /> : s.store_name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{s.store_name}</h1>
            {s.description && <p className="mt-1 max-w-xl text-white/70">{s.description}</p>}
          </div>
          <dl className="flex gap-8 text-center">
            <div><dt className="text-xs text-white/60">Products</dt><dd className="font-display text-2xl font-bold">{stats.products}</dd></div>
            <div><dt className="text-xs text-white/60">Sold</dt><dd className="font-display text-2xl font-bold">{compact(stats.units_sold)}</dd></div>
            <div><dt className="text-xs text-white/60">Rating</dt><dd className="font-display text-2xl font-bold">{stats.rating ? stats.rating.toFixed(1) : '—'}</dd></div>
          </dl>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex justify-end">
          <Select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} className="w-48">
            <option value="popular">Best selling</option><option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </Select>
        </div>
        {products.loading ? <ProductGridSkeleton /> : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {products.data?.data.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <Pagination meta={products.data?.meta} onPage={setPage} />
          </>
        )}
      </div>
    </>
  )
}
