import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Store } from 'lucide-react'
import ProductCard, { ProductGridSkeleton } from '../../components/ProductCard'
import { Button, EmptyState, PageLoader, Pagination, Select, Stars } from '../../components/ui'
import { compact, date } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

/** Reviews from delivered orders across every product this store sells. */
function StoreReviews({ slug, stats }) {
  const [page, setPage] = useState(1)
  const { data } = useFetch(`/stores/${slug}/reviews`, { page })

  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold">Store reviews</h2>
        {stats.rating_count > 0 && (
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <Stars value={stats.rating} /> {stats.rating.toFixed(1)} from {stats.rating_count} verified {stats.rating_count === 1 ? 'purchase' : 'purchases'}
          </div>
        )}
      </div>
      {data?.data.length === 0 && <p className="mt-4 text-ink-soft">No reviews yet. Only customers whose order was delivered can review this store's products.</p>}
      <ul className="mt-4 divide-y divide-line">
        {data?.data.map((r) => (
          <li key={r.id} className="py-5">
            <div className="flex items-center justify-between gap-3">
              <Stars value={r.rating} />
              <span className="text-xs text-ink-mute">{date(r.created_at)}</span>
            </div>
            {r.title && <h3 className="mt-2 font-sans text-base font-semibold tracking-normal">{r.title}</h3>}
            {r.body && <p className="mt-1 text-ink-soft">{r.body}</p>}
            <p className="mt-2 text-xs text-ink-mute">
              {r.author} · Verified purchase{r.product && <> · <Link to={`/products/${r.product.slug}`} className="hover:text-sphere">{r.product.name}</Link></>}
            </p>
          </li>
        ))}
      </ul>
      <Pagination meta={data?.meta} onPage={setPage} />
    </section>
  )
}

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
            {/* Only approved stores are public, and approval requires an accepted document. */}
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/80">
              <BadgeCheck className="size-4 text-mango" /> Verified seller{s.approved_at && ` since ${date(s.approved_at)}`}
            </p>
            {s.description && <p className="mt-1 max-w-xl text-white/70">{s.description}</p>}
          </div>
          <dl className="flex gap-8 text-center">
            <div><dt className="text-xs text-white/60">Products</dt><dd className="font-display text-2xl font-bold">{stats.products}</dd></div>
            <div><dt className="text-xs text-white/60">Sold</dt><dd className="font-display text-2xl font-bold">{compact(stats.units_sold)}</dd></div>
            <div>
              <dt className="text-xs text-white/60">Rating</dt>
              <dd className="font-display text-2xl font-bold">{stats.rating_count ? stats.rating.toFixed(1) : '—'}</dd>
              {stats.rating_count > 0 && <dd className="text-xs text-white/60">{compact(stats.rating_count)} reviews</dd>}
            </div>
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
        <StoreReviews slug={slug} stats={stats} />
      </div>
    </>
  )
}
