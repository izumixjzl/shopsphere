import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ data: [], unread_count: 0 })
  const ref = useRef(null)

  const load = () => api.get('/notifications').then((r) => setData(r.data)).catch(() => {})

  useEffect(() => {
    load()
    const t = setInterval(load, 60000) // light polling; swap for websockets later
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function markAll() {
    await api.post('/notifications/read-all')
    load()
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${data.unread_count} unread)`} aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink">
        <Bell className="size-5" />
        {data.unread_count > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold leading-4.5 text-white">
            {data.unread_count > 9 ? '9+' : data.unread_count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/10">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-semibold">Notifications</span>
            {data.unread_count > 0 && <button onClick={markAll} className="text-sm font-medium text-sphere hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data.data.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-mute">You're all caught up.</li>}
            {data.data.map((n) => (
              <li key={n.id} className={`border-b border-line px-4 py-3 last:border-0 ${n.read_at ? '' : 'bg-sphere-tint/50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold">{n.title}</span>
                  <span className="shrink-0 text-xs text-ink-mute">{timeAgo(n.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">{n.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
