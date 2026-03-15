'use client';
import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, Modal, Input, Select, ConfirmDialog, TableSkeleton, EmptyState } from '@/components/ui/components';
import { Plus, Trash2, Shield } from 'lucide-react';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'badge-red',
  MANAGER: 'badge-blue',
  STAFF: 'badge-gray',
};

function CreateUserForm({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/users', form);
      toast.success('User created successfully');
      onSave();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Full Name *" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="John Doe" />
      <Input label="Email *" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="john@example.com" />
      <Input label="Password *" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required placeholder="Minimum 8 characters" minLength={8} />
      <Select label="Role *" value={form.role} onChange={(e) => set('role', e.target.value)}>
        <option value="STAFF">Staff</option>
        <option value="MANAGER">Manager</option>
        <option value="ADMIN">Admin</option>
      </Select>
      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
        <p className="font-medium">Role permissions:</p>
        <p><strong>Staff</strong> — Customers, Invoices, Repairs, Search</p>
        <p><strong>Manager</strong> — + Inventory, Suppliers, Payments, Reports</p>
        <p><strong>Admin</strong> — Full access including Settings & User Management</p>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create User'}</button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { data, isLoading, mutate } = useSWR('/auth/users', fetcher);

  if (currentUser?.role !== 'ADMIN') {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Admin access required</p>
          <p className="text-sm text-gray-400 mt-1">Only administrators can manage users.</p>
        </div>
      </AppShell>
    );
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/auth/users/${deleting.id}`);
      toast.success('User deleted');
      mutate();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setDeleteLoading(false); setDeleting(null); }
  }

  const users = data || [];

  return (
    <AppShell>
      <PageHeader
        title="User Management"
        subtitle="Manage who has access to this system"
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />Add User
          </button>
        }
      />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Created</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton rows={4} cols={5} /> :
               !users.length ? <tr><td colSpan={5}><EmptyState title="No users found" /></td></tr> :
               users.map((u: any) => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                      {u.id === currentUser?.id && (
                        <span className="badge badge-green text-xs">You</span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell text-gray-500">{u.email}</td>
                  <td className="table-cell">
                    <span className={`badge ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="table-cell text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="table-cell">
                    {u.id !== currentUser?.id && (
                      <button onClick={() => setDeleting(u)} className="btn-icon btn-sm text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create New User">
        <CreateUserForm onSave={() => { setShowForm(false); mutate(); }} onClose={() => setShowForm(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Remove ${deleting?.name} (${deleting?.email})? They will lose all access immediately.`}
        danger
        loading={deleteLoading}
      />
    </AppShell>
  );
}
