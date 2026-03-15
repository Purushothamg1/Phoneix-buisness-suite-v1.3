'use client';
import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/components';
import DataTable from '@/components/tables/DataTable';
import { formatDateTime } from '@/lib/utils';
import { Activity, Search } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: 'badge-green', PASSWORD_CHANGED: 'badge-yellow',
  USER_CREATED: 'badge-blue', USER_DELETED: 'badge-red',
  INVOICE_CREATED: 'badge-blue', INVOICE_CANCELLED: 'badge-red',
  PAYMENT_RECORDED: 'badge-green', PAYMENT_REFUNDED: 'badge-yellow',
  REPAIR_CREATED: 'badge-purple', REPAIR_UPDATED: 'badge-blue',
  SETTINGS_UPDATED: 'badge-yellow', IMPORT_COMPLETED: 'badge-blue',
  CUSTOMER_DELETED: 'badge-red', PRODUCT_DELETED: 'badge-red',
};

export default function AuditPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user && user.role === 'STAFF') router.push('/dashboard');
  }, [user, router]);

  const { data, isLoading } = useSWR(
    `/audit?page=${page}&limit=25`,
    fetcher,
  );

  const { data: actions } = useSWR('/audit/actions', fetcher);

  const columns = [
    {
      key: 'createdAt', header: 'Time',
      render: (r: any) => <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'user', header: 'User',
      render: (r: any) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{r.user?.name || '—'}</p>
          <p className="text-xs text-gray-400">{r.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'action', header: 'Action',
      render: (r: any) => (
        <span className={`badge ${ACTION_COLORS[r.action] || 'badge-gray'} font-mono text-xs`}>
          {r.action.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'metadata', header: 'Details',
      render: (r: any) => {
        const meta = r.metadata;
        if (!meta || Object.keys(meta).length === 0) return <span className="text-gray-300">—</span>;
        const entries = Object.entries(meta).slice(0, 3);
        return (
          <div className="text-xs text-gray-500 space-y-0.5">
            {entries.map(([k, v]) => (
              <div key={k}><span className="font-medium">{k}:</span> {String(v).substring(0, 40)}</div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'role', header: 'Role',
      render: (r: any) => <span className="text-xs text-gray-500">{r.user?.role || '—'}</span>,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Audit Log"
        subtitle="Full activity history for compliance and troubleshooting"
      />

      {/* Stats strip */}
      {data?.meta && (
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
          <Activity className="w-4 h-4 text-blue-600" />
          <span><strong className="text-gray-900">{data.meta.total.toLocaleString()}</strong> total events</span>
          <span className="text-gray-300">|</span>
          <span>Page {data.meta.page} of {data.meta.totalPages}</span>
        </div>
      )}

      <DataTable
        columns={columns as any}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No audit events recorded yet."
        keyExtractor={(r: any) => r.id}
      />
    </AppShell>
  );
}
