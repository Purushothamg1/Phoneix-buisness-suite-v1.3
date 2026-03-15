'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, FileDown, Send, XCircle, RefreshCw } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import DataTable from '@/components/tables/DataTable';
import { PageHeader, StatusBadge, ConfirmDialog, Modal } from '@/components/ui';
import { formatCurrency, formatDate, getErrorMessage, downloadFile } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

interface ShareResult { pdfUrl: string; pdfName: string; whatsappUrl: string; phone: string; message: string; downloadUrl: string; }
interface Invoice {
  id: string;
  number: string;
  customer: { name: string; phone: string; };
  totalAmount: number;
  payments: { amount: number; refunded: boolean; }[];
  status: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sharePreview, setSharePreview] = useState<ShareResult | null>(null);
  const [shareLoading, setShareLoading] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR(
    `/invoices?page=${page}&limit=20&search=${encodeURIComponent(search)}&status=${status}`, fetcher,
  );

  const handleWhatsApp = async (inv: Invoice) => {
    setShareLoading(inv.id);
    try {
      const { data: share } = await api.post('/import-export/prepare-send', { type: 'invoice', id: inv.id });
      try { await downloadFile(share.downloadUrl, share.pdfName); } catch { /* PDF download failed silently */ }
      setSharePreview(share);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setShareLoading(null); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.post(`/invoices/${cancelTarget.id}/cancel`);
      toast.success(`Invoice ${cancelTarget.number} cancelled`);
      mutate();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCancelling(false); setCancelTarget(null); }
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const columns = [
    { key: 'number', header: 'Invoice #', render: (r: Invoice) => (
      <Link href={`/invoices/${r.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">{r.number}</Link>
    )},
    { key: 'customer', header: 'Customer', render: (r: Invoice) => (
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 truncate">{r.customer?.name}</p>
        <p className="text-xs text-gray-400">{r.customer?.phone}</p>
      </div>
    )},
    { key: 'total', header: 'Total', render: (r: Invoice) => {
      const paid = (r.payments || []).filter((p) => !p.refunded).reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = Math.max(0, Number(r.totalAmount) - paid);
      return (
        <div>
          <p className="font-bold text-gray-900">{formatCurrency(r.totalAmount)}</p>
          {outstanding > 0.01 && <p className="text-xs text-red-500">Due: {formatCurrency(outstanding)}</p>}
          {outstanding <= 0.01 && paid > 0 && <p className="text-xs text-emerald-600">✓ Paid</p>}
        </div>
      );
    }},
    { key: 'status', header: 'Status', render: (r: Invoice) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Date', className: 'hidden sm:table-cell', render: (r: Invoice) => <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(r.createdAt)}</span> },
    { key: 'actions', header: '', render: (r: Invoice) => (
      <div className="flex items-center gap-1">
        <Link href={`/invoices/${r.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
          <Eye className="w-4 h-4" />
        </Link>
        <button
          onClick={async () => { toast.loading('Preparing PDF…',{id:`dl-${r.id}`}); try { await downloadFile(`/api/invoices/${r.id}/pdf/download`); toast.success('Downloading',{id:`dl-${r.id}`}); } catch { toast.error('Download failed',{id:`dl-${r.id}`}); } }}
          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Download PDF"
        >
          <FileDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleWhatsApp(r)}
          disabled={shareLoading === r.id}
          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Share via WhatsApp"
        >
          {shareLoading === r.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
        {canManage && r.status !== 'CANCELLED' && (
          <button onClick={() => setCancelTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancel">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <AppShell>
      <PageHeader
        title="Invoices"
        subtitle={`${data?.meta?.total || 0} total invoices`}
        actions={<Link href="/invoices/new" className="btn-primary"><Plus className="w-4 h-4" />New Invoice</Link>}
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Search invoice # or customer…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <DataTable
        columns={columns as any}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No invoices found. Create your first invoice."
        keyExtractor={(r: any) => r.id}
      />

      {/* WhatsApp Preview */}
      <Modal open={!!sharePreview} onClose={() => setSharePreview(null)} title="Share via WhatsApp" size="md">
        {sharePreview && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-700 mb-2 uppercase tracking-wide">Message Preview</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{sharePreview.message}</pre>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-3">
              <FileDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{sharePreview.pdfName}</p>
                <p className="text-xs text-emerald-700 font-medium">✓ PDF downloaded to your device</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
              <strong>Next step:</strong> Click "Open WhatsApp" — the message is pre-filled. Attach the downloaded PDF from your device and tap send.
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              <button onClick={() => setSharePreview(null)} className="btn-secondary">Close</button>
              <button onClick={() => { window.open(sharePreview.whatsappUrl, '_blank', 'noopener,noreferrer'); setSharePreview(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <Send className="w-3.5 h-3.5" />Open WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={handleCancel}
        title="Cancel Invoice"
        message={`Cancel invoice ${cancelTarget?.number}? Stock will be restored and payments marked as refunded. This cannot be undone.`}
        confirmLabel="Cancel Invoice" danger loading={cancelling}
      />
    </AppShell>
  );
}
