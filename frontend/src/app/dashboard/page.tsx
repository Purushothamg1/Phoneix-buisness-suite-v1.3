'use client';
import AppShell from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Wrench, AlertTriangle, FileText, Plus, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate, STATUS_COLORS } from '@/lib/utils';
import useSWR from 'swr';
import api from '@/lib/api';
import Link from 'next/link';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function DashboardPage() {
  const { data, isLoading, mutate } = useSWR('/dashboard', fetcher, { refreshInterval: 60_000 });

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Business overview · auto-refreshes every minute</p>
          </div>
          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/invoices/new" className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" />New Invoice
            </Link>
            <Link href="/repairs/new" className="btn-secondary btn-sm">
              <Plus className="w-3.5 h-3.5" />New Repair
            </Link>
            <button onClick={() => mutate()} className="btn-ghost btn-sm" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Today's Sales" value={isLoading ? '…' : formatCurrency(data?.todaySales?.amount || 0)} subtitle={`${data?.todaySales?.count || 0} invoice${data?.todaySales?.count !== 1 ? 's' : ''}`} icon={<TrendingUp className="w-5 h-5" />} color="blue" />
          <StatCard title="Monthly Revenue" value={isLoading ? '…' : formatCurrency(data?.monthlyRevenue?.amount || 0)} subtitle={`${data?.monthlyRevenue?.count || 0} this month`} icon={<FileText className="w-5 h-5" />} color="green" />
          <StatCard title="Active Repairs" value={isLoading ? '…' : (data?.activeRepairs || 0)} subtitle="In progress" icon={<Wrench className="w-5 h-5" />} color="yellow" />
          <Link href="/products" className="block">
            <StatCard title="Low Stock" value={isLoading ? '…' : (data?.lowStockAlerts || 0)} subtitle={data?.lowStockAlerts > 0 ? 'Tap to view items' : 'All levels OK'} icon={<AlertTriangle className="w-5 h-5" />} color={data?.lowStockAlerts > 0 ? 'red' : 'green'} />
          </Link>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Sales This Month</h2>
            {isLoading ? <div className="h-48 bg-gray-50 rounded-xl animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.salesByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v + 'T00:00:00').getDate().toString()} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} width={38} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Sales']} labelFormatter={(l) => formatDate(l)} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="total" fill="#2563eb" radius={[6,6,0,0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Active Repairs</h2>
              <Link href="/repairs/new" className="btn-primary btn-sm"><Plus className="w-3 h-3" />New</Link>
            </div>
            {isLoading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse"/>)}</div> : (
              <div className="space-y-1.5">
                {(data?.recentRepairs || []).map((r: any) => (
                  <Link key={r.id} href={`/repairs/${r.id}`} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.brand} {r.model}</p>
                      <p className="text-xs text-gray-500 truncate">{r.customer?.name} · <span className="font-mono">{r.jobId}</span></p>
                    </div>
                    <span className={`badge ${STATUS_COLORS[r.status]||'badge-gray'} ml-2 flex-shrink-0`}>{r.status.replace(/_/g,' ')}</span>
                  </Link>
                ))}
                {!data?.recentRepairs?.length && <p className="text-sm text-gray-400 text-center py-8">No active repairs</p>}
              </div>
            )}
          </div>
        </div>

        {/* Low stock alert */}
        {(data?.lowStockItems||[]).length > 0 && (
          <div className="card border-l-4 border-red-400 bg-red-50/30">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-gray-900">Low Stock ({data.lowStockItems.length} items)</h2>
              </div>
              <Link href="/products" className="text-xs text-blue-600 hover:underline font-medium">Manage inventory →</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {data.lowStockItems.slice(0,8).map((item: any) => (
                <div key={item.id} className="bg-white rounded-xl p-3 border border-red-100">
                  <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-red-600 mt-0.5">Stock: <strong>{item.stockQty}</strong> / Min: {item.minStockLevel}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-900">Recent Invoices</h2>
            <div className="flex gap-2">
              <Link href="/invoices/new" className="btn-primary btn-sm"><Plus className="w-3 h-3" />New Invoice</Link>
              <Link href="/invoices" className="btn-ghost btn-sm text-blue-600">View all</Link>
            </div>
          </div>
          <div className="table-scroll">
            <table className="min-w-full">
              <thead><tr>
                <th className="table-header">Invoice #</th><th className="table-header">Customer</th>
                <th className="table-header">Total</th><th className="table-header">Status</th>
                <th className="table-header hidden sm:table-cell">Date</th>
              </tr></thead>
              <tbody>
                {isLoading ? [1,2,3,4].map(i=><tr key={i}><td colSpan={5}><div className="h-10 bg-gray-50 rounded-lg m-1 animate-pulse"/></td></tr>) :
                (data?.recentInvoices||[]).map((inv: any) => (
                  <tr key={inv.id} className="table-row">
                    <td className="table-cell"><Link href={`/invoices/${inv.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">{inv.number}</Link></td>
                    <td className="table-cell font-medium truncate max-w-[120px]">{inv.customer?.name}</td>
                    <td className="table-cell font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</td>
                    <td className="table-cell"><span className={`badge ${STATUS_COLORS[inv.status]}`}>{inv.status}</span></td>
                    <td className="table-cell text-gray-400 hidden sm:table-cell">{formatDate(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
