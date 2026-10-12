import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Alert, Button, ConfirmDialog, Input, Modal, PageLoader, Select, StatusBadge, Table } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../layouts/DashboardLayout'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { useFetch } from '../../lib/useFetch'

function CategoryModal({ category, parents, onClose, onSaved }) {
  const [form, setForm] = useState({ name: category.name || '', parent_id: category.parent_id || '', description: category.description || '', is_active: category.is_active ?? true, sort_order: category.sort_order ?? 0 })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function save() {
    setSaving(true); setErrors({})
    const payload = { ...form, parent_id: form.parent_id || null, sort_order: Number(form.sort_order) }
    try {
      category.id ? await api.put(`/admin/categories/${category.id}`, payload) : await api.post('/admin/categories', payload)
      toast('Category saved')
      onSaved()
    } catch (e) { setErrors(fieldErrors(e)); if (!e.response?.data?.errors) toast(errorMessage(e), 'error') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={category.id ? 'Edit category' : 'New category'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save category</Button></>}>
      <div className="grid gap-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <Select label="Parent" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} error={errors.parent_id}>
          <option value="">None (top level)</option>
          {parents.filter((p) => p.id !== category.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="size-4 accent-sphere" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible in the shop</label>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminCategories() {
  const { data, loading, reload } = useFetch('/admin/categories')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  if (loading && !data) return <PageLoader />

  const parents = data.filter((c) => !c.parent_id)
  const byParent = parents.flatMap((p) => [p, ...data.filter((c) => c.parent_id === p.id)])

  async function remove() {
    setBusy(true); setError(null)
    try { await api.delete(`/admin/categories/${deleting.id}`); toast('Category deleted'); setDeleting(null); reload() } catch (e) { setError(Object.values(fieldErrors(e))[0] || errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Categories" description="Two levels: departments and their sub-categories." actions={<Button onClick={() => setEditing({})}><Plus className="size-4" /> New category</Button>} />
      <div className="card">
        <Table rows={byParent} columns={[
          { key: 'name', label: 'Name', render: (r) => <span className={r.parent_id ? 'pl-6 text-ink-soft' : 'font-semibold'}>{r.parent_id ? '↳ ' : ''}{r.name}</span> },
          { key: 'slug', label: 'Slug', render: (r) => <span className="text-ink-mute">{r.slug}</span> },
          { key: 'products_count', label: 'Products', align: 'right' },
          { key: 'is_active', label: 'Status', render: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} /> },
          { key: 'a', label: '', align: 'right', render: (r) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => setEditing(r)} className="rounded-full px-3 py-1 text-sm font-medium text-sphere hover:bg-sphere-tint">Edit</button>
              <button onClick={() => { setError(null); setDeleting(r) }} className="rounded-full px-3 py-1 text-sm font-medium text-coral hover:bg-coral-tint">Delete</button>
            </div>) },
        ]} />
      </div>
      {editing && <CategoryModal category={editing} parents={parents} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy} tone="danger"
        title={`Delete ${deleting?.name}?`} confirmLabel="Delete category" message="Sub-categories move to the top level. Categories that still have products can't be deleted.">
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </ConfirmDialog>
    </>
  )
}
