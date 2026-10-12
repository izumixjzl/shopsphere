import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX, SlidersHorizontal, X } from 'lucide-react'
import ProductCard, { ProductGridSkeleton } from '../../components/ProductCard'
import { Button, EmptyState, Pagination, Select } from '../../components/ui'
import { useFetch } from '../../lib/useFetch'

const SORTS = [['newest', 'Newest'], ['popular', 'Best selling'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Top rated']]

function Filters({ params, set, categories }) {
  const [min, setMin] = useState(params.get('min_price') || '')
  const [max, setMax] = useState(params.get('max_price') || '')
  const active = params.get('category')

  return (
    <div className="space-y-7">
      <div>
        <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">Category</h3>
        <ul className="space-y-0.5 text-sm">
          <li><button onClick={() => set({ category: null })} className={`w-full rounded-lg px-2 py-1.5 text-left ${!active ? 'bg-sphere-tint font-semibold text-sphere-dark' : 'hover:bg-ink/5'}`}>All categories</button></li>
          {categories?.map((c) => (
            <li key={c.id}>
              <button onClick={() => set({ category: c.slug })} className={`w-full rounded-lg px-2 py-1.5 text-left ${active === c.slug ? 'bg-sphere-tint font-semibold text-sphere-dark' : 'hover:bg-ink/5'}`}>{c.name}</button>
              <ul className="ml-3 border-l border-line pl-2">
                {c.children?.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => set({ category: s.slug })} className={`w-full rounded-lg px-2 py-1 text-left text-ink-soft ${active === s.slug ? 'bg-sphere-tint font-semibold text-sphere-dark' : 'hover:bg-ink/5'}`}>{s.name}</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); set({ min_price: min || null, max_price: max || null }) }}>
        <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">Price (₱)</h3>
        <div className="flex items-center gap-2">
          <input className="field py-2" inputMode="numeric" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label="Minimum price" />
          <span className="text-ink-mute">–</span>
          <input className="field py-2" inputMode="numeric" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label="Maximum price" />
        </div>
        <Button type="submit" variant="outline" size="sm" className="mt-2 w-full">Apply price</Button>
      </form>

      <div className="space-y-2 text-sm">
        <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">Availability & rating</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-sphere" checked={params.get('in_stock') === '1'} onChange={(e) => set({ in_stock: e.target.checked ? '1' : null })} />
          In stock only
        </label>
        {[4, 3].map((r) => (
          <label key={r} className="flex items-center gap-2">
            <input type="radio" name="rating" className="size-4 accent-sphere" checked={params.get('min_rating') === String(r)} onChange={() => set({ min_rating: String(r) })} />
            {r} stars & up
          </label>
        ))}
      </div>
    </div>
  )
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const { data: categories } = useFetch('/categories')
  const query = Object.fromEntries(params.entries())
  const { data, loading, error } = useFetch('/products', { per_page: 24, ...query })

  const set = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)))
    if (!('page' in patch)) next.delete('page')
    setParams(next)
    setShowFilters(false)
  }

  const allCats = categories?.flatMap((c) => [c, ...(c.children || [])]) ?? []
  const catName = allCats.find((c) => c.slug === params.get('category'))?.name
  const title = params.get('q') ? `Results for “${params.get('q')}”` : catName || 'All products'
  const chips = ['q', 'category', 'min_price', 'max_price', 'in_stock', 'min_rating'].filter((k) => params.get(k))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {data?.meta && <p className="mt-1 text-sm text-ink-mute">{data.meta.total} products</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters(true)}><SlidersHorizontal className="size-4" /> Filters</Button>
          <Select aria-label="Sort products" value={params.get('sort') || 'newest'} onChange={(e) => set({ sort: e.target.value })} className="w-48">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((k) => (
            <button key={k} onClick={() => set({ [k]: null })} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 text-sm hover:bg-ink/10">
              {k === 'category' ? catName : k === 'in_stock' ? 'In stock' : k === 'min_rating' ? `${params.get(k)}★ & up` : k === 'q' ? `“${params.get(k)}”` : `${k === 'min_price' ? 'From' : 'Up to'} ₱${params.get(k)}`}
              <X className="size-3.5" />
            </button>
          ))}
          <button onClick={() => setParams({})} className="px-2 text-sm font-medium text-sphere hover:underline">Clear all</button>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><Filters key={params.toString()} params={params} set={set} categories={categories} /></aside>
        <div>
          {error && <p className="text-coral">{error}</p>}
          {loading ? <ProductGridSkeleton count={12} /> : data?.data.length === 0 ? (
            <EmptyState icon={SearchX} title="No products match" action={<Button variant="outline" onClick={() => setParams({})}>Clear filters</Button>}>
              Try a different search word or remove a filter.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {data?.data.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              <Pagination meta={data?.meta} onPage={(page) => set({ page: String(page) })} />
            </>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}>
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs overflow-y-auto bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button onClick={() => setShowFilters(false)} aria-label="Close filters"><X className="size-5" /></button>
            </div>
            <Filters params={params} set={set} categories={categories} />
          </div>
        </div>
      )}
    </div>
  )
}
