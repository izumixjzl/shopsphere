import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(Boolean(tokenStore.get()))

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setBooting(false); return }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      tokenStore.set(null)
      setUser(null)
    } finally {
      setBooting(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('shopsphere:unauthorized', onUnauthorized)
    return () => window.removeEventListener('shopsphere:unauthorized', onUnauthorized)
  }, [])

  // The token lives in localStorage, which all tabs share. If another tab signs in
  // or out, follow it here too, so this tab never shows one user while acting as another.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === tokenStore.key || e.key === null) refresh() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch { /* token may already be gone */ }
    tokenStore.set(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user, booting, login, register, logout, refresh, setUser,
    role: user?.role,
    sellerStatus: user?.seller_profile?.status,
  }), [user, booting, login, register, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/** Where each role lands after signing in. */
export const homeFor = (user) =>
  user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/'
