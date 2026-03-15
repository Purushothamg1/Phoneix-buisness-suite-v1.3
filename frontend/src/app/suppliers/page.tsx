'use client';
import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, SearchInput, Pagination, TableSkeleton, EmptyState, Modal, Input, Textarea, ConfirmDialog } from '@/components/ui/components';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { formatDate, getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

function SupplierForm({ supplier, onSave, onClose }: { supplier?: any; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name || '', phone: supplier?.phone || '',
    email: supplier?.email || '', address: supplier?.address || '',
    paymentTerms: supplier?.paymentTerms || '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      if (supplier) await api.put(`/suppliers/${supplier.id}`, form);
      else await api.post('/suppliers', form);
      toast.success(supplier ? 'Supplier updated' : 'Supplier added');
      onSave();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Input label="Supplier Name *" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <Input label="Phone *" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <div className="col-span-2"><Textarea label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} /></div>
        <div className="col-span-2"><Input label="Payment Terms" placeholder="Net 30, COD..." value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: '20', ...(search && { search }) });
  const { data, isLoading, mutate } = useSWR(`/suppliers?${params}`, fetcher);

  async function handleDelete() {
    if (!deleting) return; setDeleteLoading(true);
    try { await api.delete(`/suppliers/${deleting.id}`); toast.success('Supplier deleted'); mutate(); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setDeleteLoading(false); setDeleting(null); }
  }

  return (
    <AppShell>
      <PageHeader title="Suppliers" subtitle="Manage your supplier directory"
        actions={<button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="w-4 h-4" />Add Supplier</button>} />

      <div className="card">
        <div className="mb-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search suppliers..." />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Name</th><th className="table-header">Phone</th>
                <th className="table-header">Email</th><th className="table-header">Payment Terms</th>
                <th className="table-header">Added</th><th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton rows={5} cols={6} /> :
               !data?.data?.length ? <tr><td colSpan={6}><EmptyState title="No suppliers yet" description="Add your first supplier" /></td></tr> :
               data.data.map((s: any) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-medium text-gray-900">{s.name}</td>
                  <td className="table-cell">{s.phone}</td>
                  <td className="table-cell text-gray-500">{s.email || '—'}</td>
                  <td className="table-cell text-gray-500">{s.paymentTerms || '—'}</td>
                  <td className="table-cell text-gray-400 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(s); setShowForm(true); }} className="btn-icon btn-sm text-blue-600 hover:bg-blue-50"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleting(s)} className="btn-icon btn-sm text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <SupplierForm supplier={editing} onSave={() => { setShowForm(false); mutate(); }} onClose={() => setShowForm(false)} />
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        title="Delete Supplier" message={`Remove ${deleting?.name}?`} danger loading={deleteLoading} />
    </AppShell>
  );
}
