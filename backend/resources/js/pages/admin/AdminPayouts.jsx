import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { Alert, Button, ConfirmDialog, EmptyState, PageLoader, StatusBadge, Table } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { date, money } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'

export default function AdminPayouts() {
  const { data, loading, error, reload } = useFetch('/admin/payouts')
  const [confirm, setConfirm] = useState(null) // { kind: 'create'|'paid', row }
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  if (loading && !data) return <PageLoader />
  if (!data) return <Alert>{error || 'Payouts could not be loaded.'}</Alert>

  async function run() {
    setBusy(true)
    try {
      if (confirm.kind === 'create') await api.post('/admin/payouts', { seller_id: confirm.row.seller_id })
      else await api.post(`/admin/payouts/${confirm.row.id}/paid`)
      toast(confirm.kind === 'create' ? 'Payout created' : 'Payout marked as paid')
      setConfirm(null)
      reload()
    } catch (e) { toast(Object.values(fieldErrors(e))[0] || errorMessage(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Seller payouts" description="Earnings from delivered orders, net of commission." />

      <section className="card overflow-hidden">
        <h2 className="p-5 pb-2 text-lg font-bold">Ready to pay</h2>
        <Table rows={data.payable_by_seller} rowKey="seller_id"
          empty={<EmptyState icon={Wallet} title="Nothing payable right now">Seller earnings become payable once their orders are delivered.</EmptyState>}
          columns={[
            { key: 'store_name', label: 'Store', render: (r) => <span className="font-medium">{r.store_name}</span> },
            { key: 'records', label: 'Delivered orders', align: 'right' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold">{money(r.amount)}</span> },
            { key: 'a', label: '', align: 'right', render: (r) => <Button size="sm" onClick={() => setConfirm({ kind: 'create', row: r })}>Create payout</Button> },
          ]} />
      </section>

      <section className="card mt-5 overflow-hidden">
        <h2 className="p-5 pb-2 text-lg font-bold">Payout history</h2>
        <Table rows={data.payouts.data} empty={<p className="px-5 pb-6 text-sm text-ink-mute">No payouts yet.</p>}
          columns={[
            { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium">{r.reference}</span> },
            { key: 'store', label: 'Store', render: (r) => r.seller?.seller_profile?.store_name },
            { key: 'period', label: 'Orders from', render: (r) => `${date(r.period_start)} – ${date(r.period_end)}` },
            { key: 'commission_records_count', label: 'Orders', align: 'right' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'a', label: '', align: 'right', render: (r) => r.status !== 'paid' && <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: 'paid', row: r })}>Mark as paid</Button> },
          ]} />
      </section>

      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={run} loading={busy}
        title={confirm?.kind === 'create' ? `Pay ${confirm?.row.store_name}?` : `Mark ${confirm?.row.reference} as paid?`}
        confirmLabel={confirm?.kind === 'create' ? 'Create payout' : 'Mark as paid'}
        message={confirm?.kind === 'create'
          ? `Bundles ${confirm?.row.records} delivered orders into one payout of ${money(confirm?.row.amount)}.`
          : 'Do this after the bank transfer has gone through. The seller is notified.'} />
    </>
  )
}
