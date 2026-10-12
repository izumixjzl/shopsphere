import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const NotificationContext = createContext(null)
const EMPTY = { data: [], unread_count: 0 }

/** Where each role's full notification list lives. */
export const notificationsPath = (role) =>
  role === 'admin' ? '/admin/notifications' : role === 'seller' ? '/seller/notifications' : '/account/notifications'

/**
 * Latest notifications + unread count for the signed-in user.
 * New ones arrive live over Reverb; if the socket is down we poll instead.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const [state, setState] = useState(EMPTY)
  const [live, setLive] = useState(false)
  const [received, setReceived] = useState(0) // bumps on every live arrival so open lists can refresh
  const userId = user?.id

  const load = useCallback(() => api.get('/notifications').then((r) => setState(r.data)).catch(() => {}), [])

  // Initial load + live subscription.
  useEffect(() => {
    setState(EMPTY)
    setLive(false)
    if (!userId) return
    load()

    let echo = null
    let cancelled = false
    const channel = `App.Models.User.${userId}`
    const onState = ({ current }) => setLive(current === 'connected')

    // Loaded lazily so guests never download the WebSocket client.
    import('../lib/echo').then(({ getEcho }) => {
      echo = getEcho()
      if (!echo || cancelled) return
      echo.private(channel).listen('.notification.created', (n) => {
        setState((s) => ({ data: [n, ...s.data.filter((x) => x.id !== n.id)].slice(0, 15), unread_count: s.unread_count + 1 }))
        setReceived((c) => c + 1)
        toast(n.title)
      })
      const connection = echo.connector.pusher.connection
      connection.bind('state_change', onState)
      setLive(connection.state === 'connected')
    })

    return () => {
      cancelled = true
      if (echo) {
        echo.leave(channel)
        echo.connector.pusher.connection.unbind('state_change', onState)
      }
    }
  }, [userId, load, toast])

  // Fallback: poll while the socket isn't connected, and catch up whenever the tab regains focus.
  useEffect(() => {
    if (!userId) return
    const t = live ? null : setInterval(load, 30000)
    window.addEventListener('focus', load)
    return () => { clearInterval(t); window.removeEventListener('focus', load) }
  }, [userId, live, load])

  const markRead = useCallback(async (id) => {
    setState((s) => {
      const target = s.data.find((n) => n.id === id)
      const wasUnread = target ? !target.read_at : true
      return {
        data: s.data.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
        unread_count: Math.max(0, s.unread_count - (wasUnread ? 1 : 0)),
      }
    })
    try { await api.post(`/notifications/${id}/read`) } catch { load() }
  }, [load])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setState((s) => ({ data: s.data.map((n) => ({ ...n, read_at: n.read_at ?? now })), unread_count: 0 }))
    try { await api.post('/notifications/read-all') } catch { load() }
  }, [load])

  const value = useMemo(() => ({
    ...state, live, received, reload: load, markRead, markAllRead,
  }), [state, live, received, load, markRead, markAllRead])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => useContext(NotificationContext)
