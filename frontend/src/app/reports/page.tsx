'use client';
import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, StatCard } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Package, DollarSign, Download } from 'lucide-react';
import { formatCurrency, formatDate, STATUS_COLORS } from '@/lib/utils';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then((r) => r.data);
const PIE_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed'];

export default function ReportsPage() {
  const [tab, setTab] = useState<'sales'|'inventory'|'repairs'|'financial'>('sales');
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);

  const { data: salesData } = useSWR(tab==='sales' ? `/reports/sales?from=${from}&to=${to}` : null, fetcher);
  const { data: inventoryData } = useSWR(tab==='inventory' ? '/reports/inventory' : null, fetcher);
  const { data: repairData } = useSWR(tab==='repairs' ? `/reports/repairs?from=${from}&to=${to}` : null, fetcher);
  const { data: finData } = useSWR(tab==='financial' ? `/reports/financial?from=${from}&to=${to}` : null, fetcher);

  const exportExcel = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/import-export/reports/sales/export?from=${from}&to=${to}`, '_blank');
  };

  const TABS = [
    { id: 'sales', label: 'Sales' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'repairs', label: 'Repairs' },
    { id: 'financial', label: 'Financial' },
  ];

  return (
    <AppShell>
      <PageHeader title="Reports & Analytics" actions={<button onClick={exportExcel} className="btn-secondary"><Download className="w-4 h-4" />Export Excel</button>} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab===t.id?'bg-white text-blue-600 shadow-sm':'text-gray-600 hover:text-gray-900'}`}>{t.label}</button>
        ))}
      </div>

      {/* Date Range (not for inventory) */}
      {tab !== 'inventory' && (
        <div className="flex items-center gap-3 mb-6">
          <input type="date" className="input w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-gray-400">to</span>
          <input type="date" className="input w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}

      {/* Sales Tab */}
      {tab === 'sales' && salesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Total Revenue" value={formatCurrency(salesData.totalRevenue||0)} icon={<TrendingUp className="w-6 h-6" />} color="blue" />
            <StatCard title="Paid Invoices" value={salesData.paidCount||0} icon={<DollarSign className="w-6 h-6" />} color="green" />
            <StatCard title="Unpaid Invoices" value={salesData.unpaidCount||0} icon={<TrendingUp className="w-6 h-6" />} color="red" />
          </div>
          <div className="card overflow-x-auto">
            <table className="min-w-full"><thead><tr className="border-b"><th className="table-header">Invoice #</th><th className="table-header">Customer</th><th className="table-header">Total</th><th className="table-header">Status</th><th className="table-header">Date</th></tr></thead>
              <tbody>{(salesData.invoices||[]).map((inv: any) => <tr key={inv.id} className="table-row"><td className="table-cell font-mono text-xs text-blue-600">{inv.number}</td><td className="table-cell">{inv.customer?.name}</td><td className="table-cell font-bold">{formatCurrency(inv.totalAmount)}</td><td className="table-cell"><span className={`badge ${STATUS_COLORS[inv.status]}`}>{inv.status}</span></td><td className="table-cell">{formatDate(inv.createdAt)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {tab === 'inventory' && inventoryData && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Total Products" value={inventoryData.products?.length||0} icon={<Package className="w-6 h-6" />} color="blue" />
            <StatCard title="Low Stock Items" value={inventoryData.lowStockCount||0} icon={<Package className="w-6 h-6" />} color="red" />
            <StatCard title="Inventory Value" value={formatCurrency(inventoryData.inventoryValue||0)} icon={<DollarSign className="w-6 h-6" />} color="green" />
          </div>
          <div className="card overflow-x-auto">
            <table className="min-w-full"><thead><tr className="border-b"><th className="table-header">Product</th><th className="table-header">SKU</th><th className="table-header">Category</th><th className="table-header">Stock</th><th className="table-header">Purchase Price</th><th className="table-header">Selling Price</th></tr></thead>
              <tbody>{(inventoryData.products||[]).map((p: any) => <tr key={p.id} className="table-row"><td className="table-cell font-medium">{p.name}</td><td className="table-cell font-mono text-xs">{p.sku}</td><td className="table-cell">{p.category||'—'}</td><td className="table-cell"><span className={p.stockQty<=p.minStockLevel?'text-red-600 font-bold':''}>{p.stockQty}</span></td><td className="table-cell">{formatCurrency(p.purchasePrice)}</td><td className="table-cell font-medium">{formatCurrency(p.sellingPrice)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Repairs Tab */}
      {tab === 'repairs' && repairData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold mb-4">By Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={repairData.byStatus?.map((s: any) => ({ name: s.status.replace(/_/g,' '), value: s._count }))||[]} cx="50%" cy="50%" outerRadius={70} dataKey="value" label>
                    {repairData.byStatus?.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card overflow-y-auto max-h-64">
              <h3 className="font-semibold mb-4">All Repairs ({repairData.repairs?.length})</h3>
              {(repairData.repairs||[]).map((r: any) => <div key={r.id} className="flex justify-between py-2 border-b last:border-0 text-sm"><div><p className="font-medium">{r.brand} {r.model}</p><p className="text-xs text-gray-400">{r.customer?.name}</p></div><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status.replace(/_/g,' ')}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* Financial Tab */}
      {tab === 'financial' && finData && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Total Invoiced" value={formatCurrency(finData.revenue?.totalAmount||0)} icon={<TrendingUp className="w-6 h-6" />} color="blue" />
            <StatCard title="Collected" value={formatCurrency(finData.collected||0)} icon={<DollarSign className="w-6 h-6" />} color="green" />
            <StatCard title="Tax Collected" value={formatCurrency(finData.revenue?.taxAmount||0)} icon={<DollarSign className="w-6 h-6" />} color="purple" />
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">Collections by Payment Method</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={finData.byMethod?.map((m: any) => ({ method: m.method, amount: Number(m._sum.amount) }))||[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="method" /><YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="#2563eb" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </AppShell>
  );
}
