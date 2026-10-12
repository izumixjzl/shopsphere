import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { ConfirmDialog, EmptyState, Pagination, Select, StatusBadge, Table } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage } from '../../lib/api'
import { date, dateTime, humanize } from '../../lib/format'
import { useDebounced, useFetch } from '../../lib/useFetch'

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [filters, setFilters] = useState({ role: '', status: '' })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, loading, setData } = useFetch('/admin/users', { role: filters.role || undefined, status: filters.status || undefined, q: dq || undefined, page })
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function toggle() {
    setBusy(true)
    const status = target.status === 'active' ? 'suspended' : 'active'
    try {
      const { data: u } = await api.patch(`/admin/users/${target.id}/status`, { status })
      setData((d) => ({ ...d, data: d.data.map((x) => (x.id === u.id ? u : x)) }))
      toast(status === 'suspended' ? 'Account suspended and signed out' : 'Account reactivated')
      setTarget(null)
    } catch (e) { toast(errorMessage(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Users" description="Every customer, seller and admin account." />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-9" placeholder="Name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="Search users" />
          </div>
          <Select aria-label="Role" className="w-36" value={filters.role} onChange={(e) => { setFilters({ ...filters, role: e.target.value }); setPage(1) }}>
            <option value="">All roles</option><option value="customer">Customers</option><option value="seller">Sellers</option><option value="admin">Admins</option>
          </Select>
          <Select aria-label="Status" className="w-36" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}>
            <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </Select>
        </div>
        <Table loading={loading} rows={data?.data} empty={<EmptyState icon={Users} title="No users match" />}
          columns={[
            { key: 'name', label: 'Name', render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-ink-mute">{r.email}</div></div> },
            { key: 'role', label: 'Role', render: (r) => <>{humanize(r.role)}{r.seller_profile && <span className="text-ink-mute"> · {r.seller_profile.store_name}</span>}</> },
            { key: 'created_at', label: 'Joined', render: (r) => date(r.created_at) },
            { key: 'last_login_at', label: 'Last sign-in', render: (r) => dateTime(r.last_login_at) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'a', label: '', align: 'right', render: (r) => r.id !== me.id && (
              <button onClick={() => setTarget(r)} className={`rounded-full px-3 py-1 text-sm font-medium ${r.status === 'active' ? 'text-coral hover:bg-coral-tint' : 'text-leaf hover:bg-leaf-tint'}`}>
                {r.status === 'active' ? 'Suspend' : 'Reactivate'}
              </button>) },
          ]} />
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </div>
      <ConfirmDialog open={Boolean(target)} onClose={() => setTarget(null)} onConfirm={toggle} loading={busy}
        tone={target?.status === 'active' ? 'danger' : 'primary'}
        title={target?.status === 'active' ? `Suspend ${target?.name}?` : `Reactivate ${target?.name}?`}
        confirmLabel={target?.status === 'active' ? 'Suspend account' : 'Reactivate account'}
        message={target?.status === 'active' ? 'They are signed out everywhere and cannot sign in until reactivated.' : 'They can sign in again right away.'} />
    </>
  )
}
