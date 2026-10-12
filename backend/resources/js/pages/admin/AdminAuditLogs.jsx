import { useState } from 'react'
import { History } from 'lucide-react'
import { EmptyState, Pagination, Select, Table } from '../../components/ui'
import { PageHeader } from '../../layouts/DashboardLayout'
import { dateTime } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

const GROUPS = [['', 'All activity'], ['seller', 'Sellers'], ['product', 'Products'], ['inventory', 'Inventory'], ['order', 'Orders'], ['seller_order', 'Fulfilment'], ['refund', 'Refunds'], ['payout', 'Payouts'], ['user', 'Users'], ['category', 'Categories']]

const summarize = (v) => (v ? Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : x}`).join(', ') : '')

export default function AdminAuditLogs() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading } = useFetch('/admin/audit-logs', { action: action || undefined, page })

  return (
    <>
      <PageHeader title="Audit log" description="Who changed what, and when. Entries can't be edited." />
      <div className="card">
        <div className="border-b border-line p-4">
          <Select aria-label="Activity type" className="w-52" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}>
            {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <Table loading={loading} rows={data?.data} empty={<EmptyState icon={History} title="No activity yet" />}
          columns={[
            { key: 'created_at', label: 'When', render: (r) => <span className="whitespace-nowrap">{dateTime(r.created_at)}</span> },
            { key: 'user', label: 'By', render: (r) => r.user ? <div><div>{r.user.name}</div><div className="text-xs text-ink-mute">{r.user.role}</div></div> : <span className="text-ink-mute">System</span> },
            { key: 'action', label: 'Action', render: (r) => <code className="rounded bg-paper px-1.5 py-0.5 text-xs">{r.action}</code> },
            { key: 'subject', label: 'Record', render: (r) => r.auditable_type ? `${r.auditable_type.split('\\').pop()} #${r.auditable_id}` : '—' },
            { key: 'change', label: 'Change', render: (r) => (
              <div className="max-w-sm text-xs text-ink-soft">
                {r.old_values && <div className="truncate" title={summarize(r.old_values)}><span className="text-coral">−</span> {summarize(r.old_values)}</div>}
                {r.new_values && <div className="truncate" title={summarize(r.new_values)}><span className="text-leaf">+</span> {summarize(r.new_values)}</div>}
              </div>) },
            { key: 'ip_address', label: 'IP', render: (r) => <span className="text-xs text-ink-mute">{r.ip_address}</span> },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data && { current_page: data.current_page, last_page: data.last_page, total: data.total }} onPage={setPage} /></div>
      </div>
    </>
  )
}
