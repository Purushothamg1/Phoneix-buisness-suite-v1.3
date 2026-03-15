'use client';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { StatusBadge, ConfirmDialog, Spinner, Modal, FormField } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage, downloadFile } from '@/lib/utils';
import { FileDown, Send, XCircle, ArrowLeft, CreditCard, RefreshCw, ExternalLink, Check } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const fetcher = (url: string) => api.get(url).then((r) => r.data);
interface ShareResult { pdfUrl: string; pdfName: string; whatsappUrl: string; phone: string; message: string; downloadUrl: string; }

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: inv, isLoading, mutate } = useSWR(`/invoices/${id}`, fetcher);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH' });
  const [paying, setPaying] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sharePreview, setSharePreview] = useState<ShareResult | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      toast.loading('Preparing PDF…', { id: 'pdf' });
      await downloadFile(`/api/invoices/${id}/pdf/download`, inv?.pdfUrl?.split('/').pop() || `${inv?.number}.pdf`);
      toast.success('PDF download started', { id: 'pdf' });
    } catch (err) { toast.error('PDF download failed', { id: 'pdf' }); }
    finally { setPdfLoading(false); }
  };

  const handleWhatsApp = async () => {
    setShareLoading(true);
    try {
      const { data: share } = await api.post('/import-export/prepare-send', { type: 'invoice', id });
      // Simultaneously trigger PDF download
      try { await downloadFile(share.downloadUrl, share.pdfName); } catch { /* silent */ }
      setSharePreview(share);
      mutate();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setShareLoading(false); }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try { await api.post(`/invoices/${id}/cancel`); toast.success('Invoice cancelled'); mutate(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCancelling(false); setShowCancel(false); }
  };

  const handlePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await api.post('/payments', { invoiceId: id, amount: parseFloat(payForm.amount), method: payForm.method });
      toast.success('Payment recorded'); mutate(); setPayModal(false); setPayForm({ amount: '', method: 'CASH' });
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPaying(false); }
  };

  if (isLoading) return <AppShell><div className="flex justify-center py-20"><Spinner size="lg" /></div></AppShell>;
  if (!inv) return <AppShell><div className="text-center py-20 text-gray-400">Invoice not found</div></AppShell>;

  const paidAmount = (inv.payments ?? []).filter((p: any) => !p.refunded).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const outstanding = Math.max(0, Number(inv.totalAmount) - paidAmount);
  const subtotal = Number(inv.totalAmount) - Number(inv.taxAmount) + Number(inv.discount);

  return (
    <AppShell>
      <div className="mb-4"><Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-3.5 h-3.5" /> Back to Invoices</Link></div>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Invoice {inv.number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(inv.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={inv.status} />
          <button onClick={handleDownloadPdf} disabled={pdfLoading} className="btn-secondary btn-sm">
            {pdfLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={handleWhatsApp} disabled={shareLoading} className="btn-sm bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold flex items-center gap-2 px-3 py-1.5 transition-colors">
            {shareLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            WhatsApp
          </button>
          {canManage && inv.status !== 'CANCELLED' && inv.status !== 'PAID' && outstanding > 0.01 && (
            <button onClick={() => { setPayForm({ amount: outstanding.toFixed(2), method: 'CASH' }); setPayModal(true); }} className="btn-primary btn-sm">
              <CreditCard className="w-3.5 h-3.5" />Record Payment
            </button>
          )}
          {canManage && inv.status !== 'CANCELLED' && (
            <button onClick={() => setShowCancel(true)} className="btn-danger btn-sm"><XCircle className="w-3.5 h-3.5" />Cancel</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bill To</p>
            <p className="font-bold text-gray-900 text-base">{inv.customer?.name}</p>
            <p className="text-sm text-gray-500">{inv.customer?.phone}</p>
            {inv.customer?.email && <p className="text-sm text-gray-500">{inv.customer.email}</p>}
            {inv.customer?.address && <p className="text-sm text-gray-500 mt-1">{inv.customer.address}</p>}
          </div>

          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Items</p>
            <div className="table-scroll">
              <table className="min-w-full">
                <thead><tr>
                  <th className="table-header">Description</th>
                  <th className="table-header text-right">Qty</th>
                  <th className="table-header text-right hidden sm:table-cell">Unit Price</th>
                  <th className="table-header text-right hidden sm:table-cell">Tax%</th>
                  <th className="table-header text-right">Total</th>
                </tr></thead>
                <tbody>
                  {(inv.items ?? []).map((item: any) => (
                    <tr key={item.id} className="table-row">
                      <td className="table-cell"><p className="font-semibold text-gray-900">{item.description}</p>{item.product && <p className="text-xs text-gray-400">SKU: {item.product.sku}</p>}</td>
                      <td className="table-cell text-right">{item.qty}</td>
                      <td className="table-cell text-right hidden sm:table-cell">{formatCurrency(item.unitPrice)}</td>
                      <td className="table-cell text-right hidden sm:table-cell text-gray-500">{Number(item.tax)}%</td>
                      <td className="table-cell text-right font-bold">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 max-w-xs ml-auto space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(inv.taxAmount)}</span></div>
              {Number(inv.discount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatCurrency(inv.discount)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span className="text-blue-600">{formatCurrency(inv.totalAmount)}</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold">{formatCurrency(inv.totalAmount)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="font-bold">{formatCurrency(paidAmount)}</span></div>
              {outstanding > 0.01 ? (
                <div className="flex justify-between text-red-600 font-bold pt-1 border-t border-gray-100"><span>Outstanding</span><span>{formatCurrency(outstanding)}</span></div>
              ) : paidAmount > 0 ? (
                <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-semibold pt-1 border-t border-gray-100">
                  <Check className="w-4 h-4" />Fully Paid
                </div>
              ) : null}
            </div>
            {canManage && inv.status !== 'CANCELLED' && inv.status !== 'PAID' && outstanding > 0.01 && (
              <button onClick={() => { setPayForm({ amount: outstanding.toFixed(2), method: 'CASH' }); setPayModal(true); }} className="btn-primary w-full justify-center mt-4 btn-sm">
                <CreditCard className="w-3.5 h-3.5" />Record Payment
              </button>
            )}
          </div>

          {(inv.payments ?? []).length > 0 && (
            <div className="card">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment History</p>
              <div className="space-y-2">
                {inv.payments.map((p: any) => (
                  <div key={p.id} className={`flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0 ${p.refunded ? 'opacity-40' : ''}`}>
                    <div><p className="font-semibold text-gray-800">{p.method.replace('_',' ')}</p><p className="text-xs text-gray-400">{formatDateTime(p.createdAt)}</p></div>
                    <div className="text-right">
                      <p className={`font-bold ${p.refunded ? 'line-through text-gray-400' : 'text-gray-900'}`}>{formatCurrency(p.amount)}</p>
                      {p.refunded && <p className="text-xs text-red-500">Refunded</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment" size="sm">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-3 text-sm"><span className="text-gray-600">Outstanding: </span><span className="font-bold text-blue-700">{formatCurrency(outstanding)}</span></div>
          <FormField label="Amount" required>
            <input className="input" type="number" min="0.01" step="0.01" max={outstanding} value={payForm.amount} onChange={(e) => setPayForm((f) => ({...f, amount: e.target.value}))} />
          </FormField>
          <FormField label="Method" required>
            <select className="input" value={payForm.method} onChange={(e) => setPayForm((f) => ({...f, method: e.target.value}))}>
              <option value="CASH">Cash</option><option value="UPI">UPI</option>
              <option value="CARD">Card</option><option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handlePayment} disabled={paying} className="btn-primary">{paying ? 'Recording…' : 'Record Payment'}</button>
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{sharePreview.pdfName}</p>
                <p className="text-xs text-emerald-700 font-medium">✓ PDF downloaded to your device</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
              <strong>Next step:</strong> Click "Open WhatsApp" below. The message is pre-filled. Attach the downloaded PDF and tap send.
            </div>
            <div className="flex gap-3 justify-end pt-1 flex-wrap">
              <button onClick={() => setSharePreview(null)} className="btn-secondary">Close</button>
              <button onClick={() => { window.open(sharePreview.whatsappUrl, '_blank', 'noopener,noreferrer'); setSharePreview(null); }} className="btn-sm bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold flex items-center gap-2 px-4 py-2">
                <Send className="w-3.5 h-3.5" />Open WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={showCancel} onClose={() => setShowCancel(false)} onConfirm={handleCancel}
        title="Cancel Invoice" message={`Cancel invoice ${inv.number}? Stock will be restored and payments marked as refunded. This cannot be undone.`}
        confirmLabel="Yes, Cancel" danger loading={cancelling} />
    </AppShell>
  );
}
