import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingBag, Store } from 'lucide-react'
import { Alert, Button, Input, Textarea } from '../../components/ui'
import { homeFor, useAuth } from '../../context/AuthContext'
import { errorMessage, fieldErrors } from '../../lib/api'
import { AuthShell } from './Login'

export default function Register() {
  const [params] = useSearchParams()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    role: params.get('role') === 'seller' ? 'seller' : 'customer',
    name: '', email: '', phone: '', password: '', password_confirmation: '',
    store_name: '', store_description: '', business_address: '',
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const seller = form.role === 'seller'

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErrors({}); setError(null)
    try {
      const user = await register(form)
      navigate(homeFor(user), { replace: true })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      if (!Object.keys(fe).length) setError(errorMessage(err))
    } finally { setLoading(false) }
  }

  return (
    <AuthShell title={seller ? 'Open your store' : 'Create your account'}
      subtitle={seller ? 'Tell us about your business. An admin reviews every new store before it goes live.' : 'Shop from every store on ShopSphere with one cart.'}>
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-ink/5 p-1" role="radiogroup" aria-label="Account type">
        {[['customer', 'I want to shop', ShoppingBag], ['seller', 'I want to sell', Store]].map(([v, l, Icon]) => (
          <button key={v} type="button" role="radio" aria-checked={form.role === v} onClick={() => setForm({ ...form, role: v })}
            className={`flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold ${form.role === v ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}>
            <Icon className="size-4" /> {l}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Input label="Full name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" required />
          <Input label="Mobile number" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
        </div>
        {seller && (
          <>
            <Input label="Store name" value={form.store_name} onChange={set('store_name')} error={errors.store_name} required />
            <Input label="Business address" value={form.business_address} onChange={set('business_address')} error={errors.business_address} />
            <Textarea label="What do you sell?" value={form.store_description} onChange={set('store_description')} error={errors.store_description} />
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Password" type="password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" hint="8+ characters, letters and numbers" required />
          <Input label="Confirm password" type="password" value={form.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" required />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>{seller ? 'Submit store application' : 'Create account'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">Already have an account? <Link to="/login" className="font-semibold text-sphere hover:underline">Sign in</Link></p>
    </AuthShell>
  )
}
