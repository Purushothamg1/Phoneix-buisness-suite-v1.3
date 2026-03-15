'use client';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { StatusBadge, Modal, FormField, Spinner } from '@/components/ui';
import { formatCurrency, formatDate, getErrorMessage, downloadFile } from '@/lib/utils';
import { FileDown, Send, Pencil, ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const fetcher = (url: string) => api.get(url).then((r) => r.data);
const STATUSES = ['RECEIVED','DIAGNOSING','WAITING_FOR_PARTS','IN_REPAIR','READY','DELIVERED'];

interface ShareResult { pdfUrl: string; pdfName: string; whatsappUrl: string; phone: string; message: string; downloadUrl: string; }
interface Repair {
  id: string;
  jobId: string;
  customer: { name: string; phone: string; email?: string; };
  deviceType: string;
  brand: string;
  model: string;
  serialNumber?: string;
  issueDescription: string;
  repairNotes?: string;
  estimatedCost?: number;
  finalCost?: number;
  status: string;
  createdAt: string;
  technician?: { name: string; };
  parts: { id: string; product: { name: string; sku: string; }; qty: number; cost: number; }[];
  pdfUrl?: string;
}

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: repair, isLoading, mutate } = useSWR<Repair>(`/repairs/${id}`, fetcher);
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState({ status:'', repairNotes:'', finalCost:'' });
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharePreview, setSharePreview] = useState<ShareResult | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canCreateInvoice = canManage && repair && ['READY','DELIVERED'].includes(repair.status);

  const openEdit = () => {
    if (!repair) return;
    setForm({ status: repair.status, repairNotes: repair.repairNotes || '', finalCost: repair.finalCost ? String(repair.finalCost) : '' });
    setEditModal(true);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await api.put(`/repairs/${id}`, { ...form, finalCost: form.finalCost ? parseFloat(form.finalCost) : undefined });
      toast.success('Repair updated'); mutate(); setEditModal(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      toast.loading('Preparing PDF…', { id: 'pdf-repair' });
      await downloadFile(`/api/repairs/${id}/pdf/download`, repair?.pdfUrl?.split('/').pop() || `${repair?.jobId}.pdf`);
      toast.success('PDF download started', { id: 'pdf-repair' });
    } catch { toast.error('Download failed', { id: 'pdf-repair' }); }
    finally { setPdfLoading(false); }
  };

  const handleWhatsApp = async () => {
    setShareLoading(true);
    try {
      const { data: share } = await api.post('/import-export/prepare-send', { type: 'repair', id });
      try { await downloadFile(share.downloadUrl, share.pdfName); } catch { /* silent */ }
      setSharePreview(share); mutate();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setShareLoading(false); }
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const { data: inv } = await api.post(`/repairs/${id}/create-invoice`, { discount: parseFloat(invoiceDiscount) || 0 });
      toast.success(`Invoice ${inv.number} created!`);
      setInvoiceModal(false);
      router.push(`/invoices/${inv.id}`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCreatingInvoice(false); }
  };

  if (isLoading) return <AppShell><div className="flex justify-center py-20"><Spinner size="lg" /></div></AppShell>;
  if (!repair) return <AppShell><div className="text-center py-20 text-gray-400">Repair job not found</div></AppShell>;

  return (
    <AppShell>
      <div className="mb-4"><Link href="/repairs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-3.5 h-3.5" /> Back to Repairs</Link></div>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">{repair.jobId}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Created {formatDate(repair.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={repair.status} />
          <button onClick={openEdit} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" />Update</button>
          <button onClick={handleDownloadPdf} disabled={pdfLoading} className="btn-secondary btn-sm">
            {pdfLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={handleWhatsApp} disabled={shareLoading} className="btn-sm bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold flex items-center gap-2 px-3 py-1.5 transition-colors">
            {shareLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}WhatsApp
          </button>
          {canCreateInvoice && (
            <button onClick={() => setInvoiceModal(true)} className="btn-primary btn-sm">
              <FileText className="w-3.5 h-3.5" />Create Invoice
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Device Information</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-400 text-xs mb-0.5">Device Type</p><p className="font-semibold">{repair.deviceType}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Brand</p><p className="font-semibold">{repair.brand}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Model</p><p className="font-semibold">{repair.model}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Serial Number</p><p className="font-semibold">{repair.serialNumber || '—'}</p></div>
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Issue Description</p>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{repair.issueDescription}</p>
            {repair.repairNotes && (<>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-5">Repair Notes</p>
              <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{repair.repairNotes}</p>
            </>)}
          </div>

          {(repair.parts ?? []).length > 0 && (
            <div className="card">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Parts Used</p>
              <div className="table-scroll">
                <table className="min-w-full">
                  <thead><tr>
                    <th className="table-header">Product</th><th className="table-header text-right">Qty</th>
                    <th className="table-header text-right">Unit Cost</th><th className="table-header text-right">Total</th>
                  </tr></thead>
                  <tbody>
                    {repair.parts.map((p) => (
                      <tr key={p.id} className="table-row">
                        <td className="table-cell"><p className="font-semibold">{p.product?.name}</p><p className="text-xs text-gray-400">{p.product?.sku}</p></td>
                        <td className="table-cell text-right">{p.qty}</td>
                        <td className="table-cell text-right">{formatCurrency(p.cost)}</td>
                        <td className="table-cell text-right font-bold">{formatCurrency(p.qty * Number(p.cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Customer</p>
            <p className="font-bold text-gray-900">{repair.customer?.name}</p>
            <p className="text-sm text-gray-500">{repair.customer?.phone}</p>
            {repair.customer?.email && <p className="text-sm text-gray-500">{repair.customer.email}</p>}
          </div>
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Technician & Cost</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Technician</span><span className="font-semibold">{repair.technician?.name || 'Unassigned'}</span></div>
              {repair.estimatedCost && <div className="flex justify-between"><span className="text-gray-500">Estimated</span><span className="font-semibold">{formatCurrency(repair.estimatedCost)}</span></div>}
              {repair.finalCost && <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100"><span>Final Cost</span><span className="text-blue-600">{formatCurrency(repair.finalCost)}</span></div>}
            </div>
          </div>
          {canCreateInvoice && (
            <div className="card bg-blue-50 border-blue-200">
              <p className="text-sm font-bold text-blue-900 mb-1">Ready to Invoice?</p>
              <p className="text-xs text-blue-700 mb-3">This repair is {repair.status.toLowerCase()}. Create an invoice for the customer.</p>
              <button onClick={() => setInvoiceModal(true)} className="btn-primary w-full btn-sm justify-center">
                <FileText className="w-3.5 h-3.5" />Create Invoice
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Update Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Update — ${repair.jobId}`}>
        <div className="space-y-4">
          <FormField label="Status"><select className="input" value={form.status} onChange={(e) => setForm({...form, status:e.target.value})}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></FormField>
          <FormField label="Repair Notes"><textarea className="input resize-none" rows={3} value={form.repairNotes} onChange={(e) => setForm({...form, repairNotes:e.target.value})} /></FormField>
          <FormField label="Final Cost"><input className="input" type="number" min="0" step="0.01" value={form.finalCost} onChange={(e) => setForm({...form, finalCost:e.target.value})} /></FormField>
          <div className="flex gap-3 justify-end pt-2"><button onClick={() => setEditModal(false)} className="btn-secondary">Cancel</button><button onClick={handleUpdate} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Update'}</button></div>
        </div>
      </Modal>

      {/* Create Invoice Modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title={`Create Invoice from ${repair.jobId}`} size="sm">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-3 text-sm space-y-1">
            <p className="font-semibold text-gray-900">{repair.customer?.name}</p>
            <p className="text-gray-600">{repair.brand} {repair.model}</p>
            {(repair.finalCost || repair.estimatedCost) && <p className="text-blue-700 font-semibold">Cost: {formatCurrency(repair.finalCost || repair.estimatedCost || 0)}</p>}
          </div>
          <FormField label="Discount (optional)">
            <input className="input" type="number" min="0" step="0.01" value={invoiceDiscount} onChange={(e) => setInvoiceDiscount(e.target.value)} placeholder="0.00" />
          </FormField>
          <p className="text-xs text-gray-500">Parts and labour will be added as line items automatically.</p>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setInvoiceModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateInvoice} disabled={creatingInvoice} className="btn-primary">{creatingInvoice ? 'Creating…' : 'Create Invoice'}</button>
          </div>
        </div>
      </Modal>

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
              <div><p className="text-sm font-semibold text-gray-900 truncate">{sharePreview.pdfName}</p><p className="text-xs text-emerald-700 font-medium">✓ PDF downloaded to your device</p></div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800"><strong>Next:</strong> Open WhatsApp below, attach the downloaded PDF, and tap send.</div>
            <div className="flex gap-3 justify-end pt-1 flex-wrap">
              <button onClick={() => setSharePreview(null)} className="btn-secondary">Close</button>
              <button onClick={() => { window.open(sharePreview.whatsappUrl, '_blank', 'noopener,noreferrer'); setSharePreview(null); }} className="btn-sm bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold flex items-center gap-2 px-4 py-2">
                <Send className="w-3.5 h-3.5" />Open WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
