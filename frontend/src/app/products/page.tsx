'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, AlertTriangle, Package } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import DataTable from '@/components/tables/DataTable';
import { Modal, ConfirmDialog, PageHeader, FormField } from '@/components/ui';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  minStockLevel: number;
}

const EMPTY_FORM = { name:'', sku:'', barcode:'', category:'', purchasePrice:'', sellingPrice:'', stockQty:'0', minStockLevel:'5' };

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create'|'edit'|'adjust'|null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adjust, setAdjust] = useState({ quantity:'', movementType:'PURCHASE', note:'' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, mutate } = useSWR(`/products?page=${page}&limit=20&search=${encodeURIComponent(search)}`, fetcher);

  const openCreate = () => { setForm(EMPTY_FORM); setSelected(null); setModal('create'); };
  const openEdit = (p: Product) => { setSelected(p); setForm({ name:p.name, sku:p.sku, barcode:p.barcode||'', category:p.category||'', purchasePrice:String(p.purchasePrice), sellingPrice:String(p.sellingPrice), stockQty:String(p.stockQty), minStockLevel:String(p.minStockLevel) }); setModal('edit'); };
  const openAdjust = (p: Product) => { setSelected(p); setAdjust({ quantity:'', movementType:'PURCHASE', note:'' }); setModal('adjust'); };
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim()) { toast.error('Name and SKU are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, purchasePrice:parseFloat(form.purchasePrice)||0, sellingPrice:parseFloat(form.sellingPrice)||0, stockQty:parseInt(form.stockQty)||0, minStockLevel:parseInt(form.minStockLevel)||5 };
      if (modal==='create') { await api.post('/products', payload); toast.success('Product created'); }
      else if (selected) { await api.put(`/products/${selected.id}`, payload); toast.success('Product updated'); }
      mutate(); setModal(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjust.quantity || !selected) { toast.error('Enter a quantity'); return; }
    setSaving(true);
    try {
      await api.post(`/products/${selected.id}/adjust-stock`, { ...adjust, quantity:parseInt(adjust.quantity) });
      toast.success('Stock adjusted'); mutate(); setModal(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/products/${deleteTarget.id}`); toast.success('Product deleted'); mutate(); setDeleteTarget(null); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key:'name', header:'Product', render:(r: Product) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0"><Package className="w-4 h-4 text-gray-400"/></div>
        <div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{r.name}</p><p className="text-xs text-gray-400 font-mono">{r.sku}</p></div>
      </div>
    )},
    { key:'category', header:'Category', className:'hidden md:table-cell', render:(r: Product) => <span className="text-sm text-gray-600">{r.category||<span className="text-gray-300">—</span>}</span> },
    { key:'sellingPrice', header:'Price', render:(r: Product) => <span className="font-bold text-gray-900">{formatCurrency(r.sellingPrice)}</span> },
    { key:'stock', header:'Stock', render:(r: Product) => (
      <div className="flex items-center gap-1.5">
        <span className={`text-base font-bold ${r.stockQty<=r.minStockLevel?'text-red-600':'text-gray-900'}`}>{r.stockQty}</span>
        {r.stockQty<=r.minStockLevel && <AlertTriangle className="w-3.5 h-3.5 text-red-500"/>}
      </div>
    )},
    { key:'actions', header:'', render:(r: Product) => (
      <div className="flex items-center gap-1">
        <button onClick={() => openAdjust(r)} className="btn-ghost btn-sm text-blue-600 px-2">Adjust</button>
        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
        <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
      </div>
    )},
  ];

  return (
    <AppShell>
      <PageHeader title="Inventory" subtitle={`${data?.meta?.total||0} products`}
        actions={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4"/>Add Product</button>} />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
        <input className="input pl-10" placeholder="Name, SKU, barcode…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <DataTable columns={columns as any} data={data?.data||[]} meta={data?.meta} onPageChange={setPage} loading={isLoading} emptyMessage="No products found." keyExtractor={(r: any)=>r.id} />

      <Modal open={modal==='create'||modal==='edit'} onClose={() => setModal(null)} title={modal==='create'?'Add Product':'Edit Product'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormField label="Product Name" required><input className="input" value={form.name} onChange={f('name')}/></FormField></div>
          <FormField label="SKU" required><input className="input" value={form.sku} onChange={f('sku')}/></FormField>
          <FormField label="Barcode"><input className="input" value={form.barcode} onChange={f('barcode')}/></FormField>
          <FormField label="Category"><input className="input" value={form.category} onChange={f('category')}/></FormField>
          <FormField label="Purchase Price"><input className="input" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={f('purchasePrice')}/></FormField>
          <FormField label="Selling Price" required><input className="input" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={f('sellingPrice')}/></FormField>
          <FormField label="Stock Qty"><input className="input" type="number" min="0" value={form.stockQty} onChange={f('stockQty')}/></FormField>
          <FormField label="Min Stock Level"><input className="input" type="number" min="0" value={form.minStockLevel} onChange={f('minStockLevel')}/></FormField>
        </div>
        <div className="flex gap-3 justify-end pt-4"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving?'Saving…':'Save'}</button></div>
      </Modal>

      <Modal open={modal==='adjust'} onClose={() => setModal(null)} title={`Adjust Stock — ${selected?.name}`} size="sm">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-3 text-sm"><span className="text-gray-600">Current stock: </span><span className="font-bold text-blue-700">{selected?.stockQty}</span></div>
          <FormField label="Movement Type">
            <select className="input" value={adjust.movementType} onChange={(e) => setAdjust({...adjust, movementType:e.target.value})}>
              <option value="PURCHASE">Purchase (add stock)</option>
              <option value="ADJUSTMENT">Manual Adjustment</option>
              <option value="RETURN">Return (add back)</option>
            </select>
          </FormField>
          <FormField label="Quantity (positive = add, negative = deduct)">
            <input className="input" type="number" value={adjust.quantity} onChange={(e) => setAdjust({...adjust, quantity:e.target.value})} placeholder="e.g. 10 or -5"/>
          </FormField>
          <FormField label="Note"><input className="input" value={adjust.note} onChange={(e) => setAdjust({...adjust, note:e.target.value})} placeholder="Optional note…"/></FormField>
          <div className="flex gap-3 justify-end"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={handleAdjust} disabled={saving} className="btn-primary">{saving?'Saving…':'Adjust Stock'}</button></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Product" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} danger />
    </AppShell>
  );
}
