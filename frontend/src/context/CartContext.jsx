import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const isCustomer = user?.role === 'customer'
  const [cart, setCart] = useState(null)
  const [wishlist, setWishlist] = useState(new Set())

  const refresh = useCallback(async () => {
    if (!isCustomer) { setCart(null); setWishlist(new Set()); return }
    const [c, w] = await Promise.all([api.get('/cart'), api.get('/wishlist/ids')])
    setCart(c.data)
    setWishlist(new Set(w.data.data))
  }, [isCustomer])

  useEffect(() => { refresh().catch(() => {}) }, [refresh])

  const add = useCallback(async (productId, quantity = 1) => {
    const { data } = await api.post('/cart/items', { product_id: productId, quantity })
    setCart(data)
    return data
  }, [])

  const update = useCallback(async (itemId, quantity) => {
    const { data } = await api.patch(`/cart/items/${itemId}`, { quantity })
    setCart(data)
  }, [])

  const remove = useCallback(async (itemId) => {
    const { data } = await api.delete(`/cart/items/${itemId}`)
    setCart(data)
  }, [])

  const toggleWishlist = useCallback(async (productId) => {
    const { data } = await api.post(`/wishlist/${productId}`)
    setWishlist((prev) => {
      const next = new Set(prev)
      data.wishlisted ? next.add(productId) : next.delete(productId)
      return next
    })
    return data.wishlisted
  }, [])

  const value = useMemo(() => ({
    cart, count: cart?.item_count ?? 0, refresh, add, update, remove,
    wishlist, toggleWishlist, enabled: isCustomer,
  }), [cart, refresh, add, update, remove, wishlist, toggleWishlist, isCustomer])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
