import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SphereMark } from '../../components/Logo'
import { Alert, Button, Input } from '../../components/ui'
import { homeFor, useAuth } from '../../context/AuthContext'
import { errorMessage, fieldErrors } from '../../lib/api'

const DEMO = [
  ['Customer', 'customer@shopsphere.test'],
  ['Seller', 'seller1@shopsphere.test'],
  ['Admin', 'admin@shopsphere.test'],
]

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-sphere p-12 text-white lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold"><SphereMark /> ShopSphere</Link>
        <div className="absolute -bottom-40 -right-40 size-[520px] rounded-full bg-sphere-dark" aria-hidden />
        <div className="absolute -bottom-40 -right-40 size-[520px] rounded-full border-[14px] border-mango" style={{ transform: 'rotateX(70deg) rotateZ(-20deg) scale(1.4)' }} aria-hidden />
        <p className="relative mt-auto max-w-sm font-display text-4xl font-bold leading-tight">Independent stores, one checkout.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 font-display text-xl font-extrabold lg:hidden"><SphereMark /> ShopSphere</Link>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-soft">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErrors({}); setError(null)
    try {
      const user = await login(form.email, form.password)
      const back = state?.from
      navigate(back && user.role === 'customer' ? back : homeFor(user), { replace: true })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      if (!Object.keys(fe).length) setError(errorMessage(err))
    } finally { setLoading(false) }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to shop, sell, or manage the marketplace.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} required autoFocus />
        <Input label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} required />
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">New here? <Link to="/register" className="font-semibold text-sphere hover:underline">Create an account</Link></p>

      <div className="mt-10 rounded-xl border border-dashed border-line p-4">
        <p className="text-sm font-medium">Demo accounts (password: password123)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map(([label, email]) => (
            <button key={email} type="button" onClick={() => setForm({ email, password: 'password123' })}
              className="rounded-full bg-ink/5 px-3 py-1.5 text-sm hover:bg-ink/10">{label}</button>
          ))}
        </div>
      </div>
    </AuthShell>
  )
}
