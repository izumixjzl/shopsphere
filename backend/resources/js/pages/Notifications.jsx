import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useOpenNotification, NotificationItem } from '../components/NotificationBell'
import { Button, EmptyState, Pagination, Skeleton } from '../components/ui'
import { useNotifications } from '../context/NotificationContext'
import { PageHeader } from '../layouts/DashboardLayout'
import { useFetch } from '../lib/useFetch'

/** Full notification history; used by customers, sellers and admins. `framed` adds storefront page padding. */
export default function Notifications({ framed = false }) {
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data, loading, reload, setData } = useFetch('/notifications', { page, unread: unreadOnly ? 1 : undefined })
  const { unread_count: unread, received, live, markAllRead } = useNotifications()
  const openNotification = useOpenNotification()

  // A live notification arrived: refresh the list we're looking at.
  useEffect(() => { if (received) reload() }, [received])

  const now = () => new Date().toISOString()
  const markLocal = (match) => setData((d) => d && ({ ...d, data: d.data.map((n) => (match(n) ? { ...n, read_at: n.read_at ?? now() } : n)) }))

  const body = (
    <>
      <PageHeader title="Notifications"
        description={live ? 'Updates appear here the moment they happen.' : 'Order updates, alerts and messages from ShopSphere.'}
        actions={unread > 0 && <Button variant="outline" size="sm" onClick={() => { markAllRead(); markLocal(() => true) }}>Mark all as read</Button>} />
      <div className="card">
        <div className="flex gap-1 border-b border-line p-3" role="tablist">
          {[[false, 'All'], [true, `Unread${unread ? ` (${unread})` : ''}`]].map(([value, label]) => (
            <button key={label} role="tab" aria-selected={unreadOnly === value} onClick={() => { setUnreadOnly(value); setPage(1) }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${unreadOnly === value ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5'}`}>
              {label}
            </button>
          ))}
        </div>
        {loading && !data ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : data?.data.length ? (
          <ul className="divide-y divide-line">
            {data.data.map((n) => (
              <li key={n.id}><NotificationItem n={n} onOpen={(x) => { markLocal((y) => y.id === x.id); openNotification(x) }} /></li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}>
            We'll let you know when something needs your attention.
          </EmptyState>
        )}
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
    </>
  )

  return framed ? <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{body}</div> : body
}
