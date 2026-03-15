'use client';
import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, Modal, FormField, StatusBadge, Spinner } from '@/components/ui';
import { Plus, RotateCcw, RefreshCw, CreditCard, DollarSign, AlertCircle, Search, RefreshCcw } from 'lucide-react';
import { formatCurrency, formatDateTime, getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

const METHOD_COLORS: Record<string, string> = { CASH:'badge-green', UPI:'badge-blue', CARD:'badge-purple', BANK_TRANSFER:'badge-yellow' };
const METHOD_ICONS: Record<string, string> = { CASH:'💵', UPI:'📱', CARD:'💳', BANK_TRANSFER:'🏦' };

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [refunding, setRefunding] = useState<any>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Form state
  const [form, setForm] = useState({ invoiceId:'', amount:'', method:'CASH' });
  const [formLoading, setFormLoading] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const paymentsUrl = `/payments?page=${page}&limit=25${methodFilter ? `&method=${methodFilter}` : ''}`;
  const { data: paymentsData, isLoading, mutate } = useSWR(paymentsUrl, fetcher);
  const { data: summary, mutate: mutateSummary } = useSWR('/payments/summary', fetcher);

  const payments = paymentsData?.data || [];

  const lookupInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setLookingUp(true);
    try {
      const { data } = await api.get(`/invoices?search=${encodeURIComponent(invoiceSearch)}&limit=1`);
      const inv = data.data?.[0];
      if (inv) {
        setInvoiceDetails(inv);
        setForm((f) => ({ ...f, invoiceId: inv.id }));
        const paid = (inv.payments || []).filter((p: any) => !p.refunded).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const outstanding = Math.max(0, Number(inv.totalAmount) - paid).toFixed(2);
        setForm((f) => ({ ...f, amount: outstanding }));
      } else {
        toast.error('Invoice not found'); setInvoiceDetails(null);
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLookingUp(false); }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoiceId) { toast.error('Look up an invoice first'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setFormLoading(true);
    try {
      await api.post('/payments', { invoiceId: form.invoiceId, amount: parseFloat(form.amount), method: form.method });
      toast.success('Payment recorded');
      setShowForm(false); setForm({ invoiceId:'', amount:'', method:'CASH' }); setInvoiceDetails(null); setInvoiceSearch('');
      mutate(); mutateSummary();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setFormLoading(false); }
  };

  const handleRefund = async () => {
    if (!refunding) return;
    setRefundLoading(true);
    try {
      await api.post('/payments/refund', { paymentId: refunding.id });
      toast.success('Payment refunded'); mutate(); mutateSummary();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setRefundLoading(false); setRefunding(null); }
  };

  return (
    <AppShell>
      <PageHeader title="Payments" subtitle="Track all payment transactions"
        actions={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />Record Payment</button>} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {summary ? (
          <>
            <div className="card-sm">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-emerald-600" /><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Collected</p></div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalCollected || 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.totalCount || 0} payments</p>
            </div>
            {(['CASH','UPI','CARD'] as const).map((m) => {
              const found = (summary.byMethod || []).find((x: any) => x.method === m);
              return (
                <div key={m} className="card-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{METHOD_ICONS[m]}</span>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{m.replace('_',' ')}</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(found?.total || 0)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{found?.count || 0} payments</p>
                </div>
              );
            })}
          </>
        ) : (
          <div className="col-span-4 flex justify-center py-4"><Spinner /></div>
        )}
      </div>

      {/* Refund summary */}
      {summary?.refunds?.total > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{summary.refunds.count} refund{summary.refunds.count !== 1 ? 's' : ''} totalling {formatCurrency(summary.refunds.total)} this period</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select className="input w-44" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
          <option value="">All Methods</option>
          <option value="CASH">Cash</option><option value="UPI">UPI</option>
          <option value="CARD">Card</option><option value="BANK_TRANSFER">Bank Transfer</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-scroll">
          <table className="min-w-full">
            <thead><tr>
              <th className="table-header">Invoice #</th><th className="table-header">Customer</th>
              <th className="table-header">Amount</th><th className="table-header">Method</th>
              <th className="table-header">Status</th><th className="table-header hidden sm:table-cell">Date</th>
              <th className="table-header">Action</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                [1,2,3,4,5].map(i => <tr key={i}>{[1,2,3,4,5,6,7].map(j=><td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse"/></td>)}</tr>)
              ) : !payments.length ? (
                <tr><td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-16">
                    <CreditCard className="w-12 h-12 text-gray-200 mb-3" />
                    <p className="text-gray-500 font-medium">No payments recorded</p>
                    <p className="text-sm text-gray-400 mt-1">Record your first payment to see it here</p>
                    <button onClick={() => setShowForm(true)} className="btn-primary btn-sm mt-4"><Plus className="w-3.5 h-3.5" />Record Payment</button>
                  </div>
                </td></tr>
              ) : payments.map((p: any) => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell"><Link href={`/invoices/${p.invoiceId}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">{p.invoice?.number}</Link></td>
                  <td className="table-cell font-medium text-gray-900 truncate max-w-[120px]">{p.invoice?.customer?.name}</td>
                  <td className="table-cell font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                  <td className="table-cell"><span className={`badge ${METHOD_COLORS[p.method]}`}>{METHOD_ICONS[p.method]} {p.method.replace('_',' ')}</span></td>
                  <td className="table-cell">
                    {p.refunded ? <span className="badge badge-red">Refunded</span> : <span className="badge badge-green">Received</span>}
                  </td>
                  <td className="table-cell text-gray-400 text-xs hidden sm:table-cell">{formatDateTime(p.createdAt)}</td>
                  <td className="table-cell">
                    {!p.refunded && (
                      <button onClick={() => setRefunding(p)} className="btn-ghost btn-sm text-amber-600 hover:bg-amber-50" title="Refund">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {paymentsData?.meta && paymentsData.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Showing {(page-1)*25+1}–{Math.min(page*25, paymentsData.meta.total)} of {paymentsData.meta.total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p=>p-1)} disabled={page<=1} className="btn-secondary btn-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p=>p+1)} disabled={page>=paymentsData.meta.totalPages} className="btn-secondary btn-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setInvoiceDetails(null); setInvoiceSearch(''); }} title="Record Payment">
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="label">Find Invoice</label>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Invoice # or customer name…" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookupInvoice())} />
              <button type="button" className="btn-secondary btn-sm px-3" onClick={lookupInvoice} disabled={lookingUp}>
                {lookingUp ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {invoiceDetails && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm space-y-1">
              <p className="font-bold text-gray-900">{invoiceDetails.number} — {invoiceDetails.customer?.name}</p>
              <p className="text-gray-600">Total: <strong>{formatCurrency(invoiceDetails.totalAmount)}</strong></p>
              <p className="text-emerald-700 font-semibold">
                Outstanding: {formatCurrency(Math.max(0, Number(invoiceDetails.totalAmount) - (invoiceDetails.payments||[]).filter((p: any)=>!p.refunded).reduce((s: number,p: any)=>s+Number(p.amount),0)))}
              </p>
              <StatusBadge status={invoiceDetails.status} />
            </div>
          )}

          <FormField label="Amount *">
            <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((f)=>({...f, amount:e.target.value}))} required />
          </FormField>
          <FormField label="Payment Method *">
            <select className="input" value={form.method} onChange={(e) => setForm((f)=>({...f, method:e.target.value}))}>
              <option value="CASH">💵 Cash</option><option value="UPI">📱 UPI</option>
              <option value="CARD">💳 Card</option><option value="BANK_TRANSFER">🏦 Bank Transfer</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setInvoiceDetails(null); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={formLoading || !form.invoiceId}>{formLoading ? 'Recording…' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>

      {/* Refund Dialog */}
      <Modal open={!!refunding} onClose={() => setRefunding(null)} title="Refund Payment" size="sm">
        {refunding && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-semibold text-gray-900">Refund {formatCurrency(refunding.amount)}?</p>
              <p className="text-sm text-gray-600 mt-1">Invoice: {refunding.invoice?.number} · {refunding.method.replace('_',' ')}</p>
              <p className="text-xs text-amber-700 mt-2">This will mark the payment as refunded and update the invoice status.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRefunding(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleRefund} disabled={refundLoading} className="btn-danger">{refundLoading ? 'Processing…' : 'Confirm Refund'}</button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
