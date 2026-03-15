'use client';
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/components';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function ImportExportPage() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exporting, setExporting] = useState('');

  async function handleImport() {
    if (!importFile) return; setImporting(true);
    try {
      const fd = new FormData(); fd.append('file', importFile);
      const { data } = await api.post('/import-export/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(data);
      toast.success(`Imported ${data.imported} products`);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setImporting(false); }
  }

  async function handleExport(type: string) {
    setExporting(type);
    try {
      const url = type === 'products' ? '/import-export/products/export' : '/import-export/reports/sales/export';
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = type === 'products' ? 'products-export.xlsx' : 'sales-report.xlsx';
      link.click();
      toast.success('File downloaded');
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setExporting(''); }
  }

  return (
    <AppShell>
      <PageHeader title="Import / Export" subtitle="Bulk import products and export reports" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Import */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Import Products</h2>
              <p className="text-xs text-gray-500">Upload CSV or Excel file</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-2">Drag & drop or click to select</p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }} className="text-xs text-gray-500 file:mr-2 file:btn file:btn-secondary file:btn-sm" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-1">Expected columns:</p>
              <p className="text-xs text-gray-400 font-mono">sku, name, category, purchasePrice, sellingPrice, stockQty, minStockLevel</p>
            </div>
            {importFile && (
              <button className="btn-primary w-full" onClick={handleImport} disabled={importing}>
                <Upload className="w-4 h-4" />{importing ? 'Importing...' : `Import "${importFile.name}"`}
              </button>
            )}
            {importResult && (
              <div className="rounded-xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-600"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">{importResult.imported} products imported</span></div>
                {importResult.skipped > 0 && <div className="flex items-center gap-2 text-yellow-600"><XCircle className="w-4 h-4" /><span className="text-sm">{importResult.skipped} rows skipped</span></div>}
                {importResult.errors?.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-2 mt-2">
                    {importResult.errors.slice(0, 3).map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                    {importResult.errors.length > 3 && <p className="text-xs text-red-400">+{importResult.errors.length - 3} more errors</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Exports */}
        <div className="space-y-4">
          {[
            { type: 'products', label: 'Export Products', desc: 'Download all products as Excel', icon: '📦' },
            { type: 'sales', label: 'Export Sales Report', desc: 'Download sales data as Excel', icon: '📊' },
          ].map(({ type, label, desc, icon }) => (
            <div key={type} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
                <button className="btn-secondary btn-sm" onClick={() => handleExport(type)} disabled={exporting === type}>
                  <Download className="w-3.5 h-3.5" />{exporting === type ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
