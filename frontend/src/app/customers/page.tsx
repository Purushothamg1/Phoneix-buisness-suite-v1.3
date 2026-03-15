'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, Pencil, Trash2, Phone, Mail, History } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import DataTable from '@/components/tables/DataTable';
import { Modal, ConfirmDialog, PageHeader, FormField, StatusBadge } from '@/components/ui';
import { formatDate, formatCurrency, getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import Link from 'next/link';

const fetcher = (url: string) => api.get(url).then((r) => r.data);
const EMPTY = { name:'', phone:'', email:'', address:'', notes:'' };

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create'|'edit'|'view'|'history'|null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, mutate } = useSWR(`/customers?page=${page}&limit=20&search=${encodeURIComponent(search)}`, fetcher);
  const { data: history, isLoading: histLoading } = useSWR(
    modal === 'history' && selected ? `/customers/${selected.id}/history` : null, fetcher
  );

  const openCreate = () => { setForm(EMPTY); setSelected(null); setModal('create'); };
  const openEdit = (c: Customer) => { setSelected(c); setForm({ name:c.name, phone:c.phone, email:c.email||'', address:c.address||'', notes:c.notes||'' }); setModal('edit'); };
  const openView = (c: Customer) => { setSelected(c); setModal('view'); };
  const openHistory = (c: Customer) => { setSelected(c); setModal('history'); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Name and phone are required'); return; }
    setSaving(true);
    try {
      if (modal === 'create') { await api.post('/customers', form); toast.success('Customer created'); }
      else if (selected) { await api.put(`/customers/${selected.id}`, form); toast.success('Customer updated'); }
      mutate(); setModal(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/customers/${deleteTarget.id}`); toast.success('Customer deleted'); mutate(); setDeleteTarget(null); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const columns = [
    { key:'name', header:'Name', render:(r: Customer) => <span className="font-semibold text-gray-900">{r.name}</span> },
    { key:'phone', header:'Phone', render:(r: Customer) => <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-gray-400 flex-shrink-0"/><span className="text-sm">{r.phone}</span></span> },
    { key:'email', header:'Email', className:'hidden md:table-cell', render:(r: Customer) => r.email ? <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-gray-400 flex-shrink-0"/><span className="text-sm truncate max-w-[140px]">{r.email}</span></span> : <span className="text-gray-300">—</span> },
    { key:'createdAt', header:'Added', className:'hidden lg:table-cell', render:(r: Customer) => <span className="text-sm text-gray-500">{formatDate(r.createdAt)}</span> },
    { key:'actions', header:'', render:(r: Customer) => (
      <div className="flex items-center gap-1">
        <button onClick={() => openView(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-4 h-4"/></button>
        <button onClick={() => openHistory(r)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="History"><History className="w-4 h-4"/></button>
        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4"/></button>
        <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4"/></button>
      </div>
    )},
  ];

  return (
    <AppShell>
      <PageHeader title="Customers" subtitle={`${data?.meta?.total||0} customers`}
        actions={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4"/>New Customer</button>} />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
        <input className="input pl-10" placeholder="Search name, phone, email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <DataTable columns={columns as any} data={data?.data||[]} meta={data?.meta} onPageChange={setPage} loading={isLoading} emptyMessage="No customers found. Add your first customer." keyExtractor={(r: any)=>r.id} />

      <Modal open={modal==='create'||modal==='edit'} onClose={() => setModal(null)} title={modal==='create'?'New Customer':'Edit Customer'}>
        <div className="space-y-4">
          <FormField label="Full Name" required><input className="input" value={form.name} onChange={f('name')} placeholder="John Doe"/></FormField>
          <FormField label="Phone Number" required><input className="input" value={form.phone} onChange={f('phone')} placeholder="+91 9999999999"/></FormField>
          <FormField label="Email"><input className="input" type="email" value={form.email} onChange={f('email')} placeholder="john@example.com"/></FormField>
          <FormField label="Address"><textarea className="input resize-none" rows={2} value={form.address} onChange={f('address')}/></FormField>
          <FormField label="Notes"><textarea className="input resize-none" rows={2} value={form.notes} onChange={f('notes')}/></FormField>
          <div className="flex gap-3 justify-end pt-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving?'Saving…':'Save'}</button></div>
        </div>
      </Modal>

      <Modal open={modal==='view'} onClose={() => setModal(null)} title="Customer Details">
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Name</p><p className="font-semibold">{selected.name}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Phone</p><p className="font-semibold">{selected.phone}</p></div>
              {selected.email && <div className="bg-gray-50 rounded-xl p-3 col-span-2"><p className="text-xs text-gray-500 mb-1">Email</p><p className="font-semibold">{selected.email}</p></div>}
            </div>
            {selected.address && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Address</p><p className="font-semibold">{selected.address}</p></div>}
            {selected.notes && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Notes</p><p className="font-semibold">{selected.notes}</p></div>}
            <div className="flex gap-3 pt-2">
              <Link href={`/invoices/new`} className="btn-primary btn-sm flex-1 justify-center">New Invoice</Link>
              <Link href={`/repairs/new`} className="btn-secondary btn-sm flex-1 justify-center">New Repair</Link>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal==='history'} onClose={() => setModal(null)} title={`History — ${selected?.name}`} size="lg">
        {histLoading ? <div className="py-8 text-center text-gray-400">Loading…</div> : history && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-red-800">Outstanding Balance</span>
              <span className="text-lg font-bold text-red-700">{formatCurrency(history.outstandingBalance)}</span>
            </div>
            {history.invoices?.length > 0 && (
              <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Recent Invoices</p>
                <div className="space-y-2">{history.invoices.slice(0,5).map((inv: any) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors">
                    <div><p className="font-mono text-xs font-bold text-blue-600">{inv.number}</p><p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p></div>
                    <div className="text-right"><p className="font-bold text-sm">{formatCurrency(inv.totalAmount)}</p><StatusBadge status={inv.status}/></div>
                  </Link>
                ))}</div>
              </div>
            )}
            {history.repairs?.length > 0 && (
              <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Recent Repairs</p>
                <div className="space-y-2">{history.repairs.slice(0,5).map((r: any) => (
                  <Link key={r.id} href={`/repairs/${r.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors">
                    <div><p className="font-mono text-xs font-bold text-blue-600">{r.jobId}</p><p className="text-xs text-gray-500">{r.brand} {r.model} · {formatDate(r.createdAt)}</p></div>
                    <StatusBadge status={r.status}/>
                  </Link>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Customer" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} danger />
    </AppShell>
  );
}
