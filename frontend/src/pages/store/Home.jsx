import { Link } from 'react-router-dom'
import { Banknote, Store, Truck } from 'lucide-react'
import ProductCard, { ProductGridSkeleton } from '../../components/ProductCard'
import { Button } from '../../components/ui'
import { useFetch } from '../../lib/useFetch'

/** Product photos circling the sphere — the one piece of ambient motion on the site. */
function Orbit({ products }) {
  const ring = products.slice(0, 6)
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" aria-hidden>
      <div className="absolute inset-[18%] rounded-full bg-sphere" />
      <div className="absolute inset-[18%] rounded-full border-[10px] border-mango/90" style={{ transform: 'rotateX(72deg) rotateZ(-20deg) scale(1.55)' }} />
      <div className="absolute inset-[38%] rounded-full bg-paper" />
      {ring.map((p, i) => (
        <div key={p.id} className="absolute left-1/2 top-1/2 -ml-[11%] -mt-[11%] w-[22%]">
          <div className="orbit-item" style={{ '--r': 'min(190px, 42vw)', '--t': '48s', '--d': `${(-48 / ring.length) * i}s` }}>
            <img src={p.image_url} alt="" className="aspect-square w-full rounded-full border-4 border-white object-cover shadow-lg shadow-ink/15" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const popular = useFetch('/products', { sort: 'popular', per_page: 8 })
  const fresh = useFetch('/products', { sort: 'newest', per_page: 4 })
  const { data: categories } = useFetch('/categories')
  const products = popular.data?.data ?? []

  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <h1 className="text-[clamp(2.6rem,7vw,5rem)] font-extrabold leading-[0.95]">
            Many stores.<br />One cart.
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">
            Shop gadgets, fashion and home finds from independent Filipino sellers, check out once, and pay cash when it arrives.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" to="/shop">Start shopping</Button>
            <Button size="lg" variant="outline" to="/register?role=seller">Open your store</Button>
          </div>
          <ul className="mt-10 grid max-w-lg gap-4 text-sm text-ink-soft sm:grid-cols-3">
            <li className="flex items-center gap-2"><Store className="size-4 text-sphere" /> Verified sellers</li>
            <li className="flex items-center gap-2"><Banknote className="size-4 text-sphere" /> Cash on delivery</li>
            <li className="flex items-center gap-2"><Truck className="size-4 text-sphere" /> Live order tracking</li>
          </ul>
        </div>
        {products.length > 0 ? <Orbit products={products} /> : <div className="mx-auto aspect-square w-full max-w-[440px] rounded-full bg-sphere-tint" />}
      </section>

      {categories?.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold">Browse by category</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.map((c, i) => (
              <Link key={c.id} to={`/shop?category=${c.slug}`}
                className={`group rounded-[var(--radius-card)] p-5 transition-colors ${['bg-sphere text-white', 'bg-mango text-ink', 'bg-ink text-white', 'bg-white text-ink border border-line'][i % 4]}`}>
                <span className="font-display text-xl font-bold">{c.name}</span>
                <span className="mt-6 block text-sm opacity-80">{c.children?.map((x) => x.name).join(', ')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">Best sellers this month</h2>
          <Link to="/shop?sort=popular" className="text-sm font-semibold text-sphere hover:underline">See all</Link>
        </div>
        <div className="mt-6">
          {popular.loading ? <ProductGridSkeleton /> : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 rounded-[24px] bg-ink p-8 text-white md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-3xl font-bold">Sell to customers across the Philippines</h2>
            <p className="mt-3 max-w-md text-white/70">Set up your storefront, list products with stock tracking, and get paid out for every delivered order. We only take a commission when you sell.</p>
            <Button className="mt-6" variant="mango" to="/register?role=seller">Apply to sell</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(fresh.data?.data ?? []).map((p) => (
              <Link key={p.id} to={`/products/${p.slug}`} className="overflow-hidden rounded-xl bg-white/5">
                <img src={p.image_url} alt={p.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <span className="block truncate px-3 py-2 text-sm">{p.seller?.store_name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
