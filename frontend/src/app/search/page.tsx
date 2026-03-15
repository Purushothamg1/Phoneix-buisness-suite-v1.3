'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/components';
import { Search, Users, Package, FileText, Wrench } from 'lucide-react';
import { formatCurrency, formatDate, STATUS_COLORS } from '@/lib/utils';
import api from '@/lib/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Proper stable debounce using a ref-based timer
  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 350);
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch { setResults(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { doSearch(debouncedQuery); }, [debouncedQuery, doSearch]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const total = results ? (results.customers?.length ?? 0) + (results.products?.length ?? 0) + (results.invoices?.length ?? 0) + (results.repairs?.length ?? 0) : 0;

  return (
    <AppShell>
      <PageHeader title="Global Search" subtitle="Search across all records" />
      <div className="max-w-2xl space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={query} onChange={(e) => handleChange(e.target.value)} autoFocus
            placeholder="Search customers, products, invoices, repairs..." className="input pl-12 py-3 text-base w-full" />
          {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
        </div>

        {query.length > 0 && query.length < 2 && <p className="text-sm text-gray-400">Type at least 2 characters to search</p>}

        {results && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">{total} result{total !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;</p>

            {(results.customers?.length ?? 0) > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-semibold text-gray-700">Customers</h3></div>
                <div className="space-y-1">
                  {results.customers.map((c: any) => (
                    <button key={c.id} onClick={() => router.push('/customers')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div><p className="text-sm font-medium text-gray-900">{c.name}</p><p className="text-xs text-gray-400">{c.phone}{c.email ? ` · ${c.email}` : ''}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(results.products?.length ?? 0) > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-green-600" /><h3 className="text-sm font-semibold text-gray-700">Products</h3></div>
                <div className="space-y-1">
                  {results.products.map((p: any) => (
                    <button key={p.id} onClick={() => router.push('/products')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div><p className="text-sm font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-400">{p.sku} · Stock: {p.stockQty}</p></div>
                      <span className="text-sm font-medium text-green-600">{formatCurrency(p.sellingPrice)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(results.invoices?.length ?? 0) > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-purple-600" /><h3 className="text-sm font-semibold text-gray-700">Invoices</h3></div>
                <div className="space-y-1">
                  {results.invoices.map((inv: any) => (
                    <button key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div><p className="text-sm font-medium text-gray-900">{inv.number}</p><p className="text-xs text-gray-400">{inv.customer?.name} · {formatDate(inv.createdAt)}</p></div>
                      <div className="flex items-center gap-2"><span className={`badge ${STATUS_COLORS[inv.status]||'badge-gray'}`}>{inv.status}</span><span className="text-sm font-medium">{formatCurrency(inv.totalAmount)}</span></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(results.repairs?.length ?? 0) > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Wrench className="w-4 h-4 text-orange-600" /><h3 className="text-sm font-semibold text-gray-700">Repairs</h3></div>
                <div className="space-y-1">
                  {results.repairs.map((r: any) => (
                    <button key={r.id} onClick={() => router.push(`/repairs/${r.id}`)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div><p className="text-sm font-medium text-gray-900">{r.jobId} — {r.brand} {r.model}</p><p className="text-xs text-gray-400">{r.customer?.name}</p></div>
                      <span className={`badge ${STATUS_COLORS[r.status]||'badge-gray'}`}>{r.status.replace(/_/g,' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {total === 0 && debouncedQuery.length >= 2 && !loading && (
              <div className="text-center py-12"><Search className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-400">No results found for &ldquo;{debouncedQuery}&rdquo;</p></div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
