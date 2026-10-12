import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { notificationsPath, useNotifications } from '../context/NotificationContext'
import { timeAgo } from '../lib/format'

/** One notification row; shared by the bell dropdown and the full page. */
export function NotificationItem({ n, onOpen }) {
  return (
    <button onClick={() => onOpen(n)} className={`block w-full px-4 py-3 text-left hover:bg-paper ${n.read_at ? '' : 'bg-sphere-tint/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-sphere" aria-label="Unread" />}
          {n.title}
        </span>
        <span className="shrink-0 text-xs text-ink-mute">{timeAgo(n.created_at)}</span>
      </div>
      <p className="mt-0.5 text-sm text-ink-soft">{n.message}</p>
    </button>
  )
}

/** Marks a notification read and follows its link, if it has one. */
export function useOpenNotification() {
  const { markRead } = useNotifications()
  const navigate = useNavigate()
  return (n) => {
    if (!n.read_at) markRead(n.id)
    if (n.data?.url) navigate(n.data.url)
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { role } = useAuth()
  const { data, unread_count: unread, markAllRead } = useNotifications()
  const openNotification = useOpenNotification()
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`} aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink">
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold leading-4.5 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/10">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-semibold">Notifications</span>
            {unread > 0 && <button onClick={markAllRead} className="text-sm font-medium text-sphere hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-mute">You're all caught up.</li>}
            {data.map((n) => (
              <li key={n.id}><NotificationItem n={n} onOpen={(x) => { setOpen(false); openNotification(x) }} /></li>
            ))}
          </ul>
          <Link to={notificationsPath(role)} onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-sphere hover:bg-paper">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
