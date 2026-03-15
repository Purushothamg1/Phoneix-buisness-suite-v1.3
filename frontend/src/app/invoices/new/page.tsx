'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowLeft, UserPlus, PackagePlus } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, FormField, Modal } from '@/components/ui';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import Link from 'next/link';

interface LineItem { productId: string; description: string; qty: number; unitPrice: number; tax: number; }
interface Customer { id: string; name: string; phone: string; }
interface Product { id: string; name: string; sellingPrice: number; stockQty: number; }

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([{ productId: '', description: '', qty: 1, unitPrice: 0, tax: 18 }]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Inline new customer
  const [newCustModal, setNewCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' });
  const [savingCust, setSavingCust] = useState(false);

  // Inline new product
  const [newProdModal, setNewProdModal] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', sku: '', sellingPrice: '', purchasePrice: '0', stockQty: '0', category: '' });
  const [savingProd, setSavingProd] = useState(false);

  const load = () => {
    api.get('/customers?limit=500').then((r) => setCustomers(r.data.data || [])).catch(() => {});
    api.get('/products?limit=500').then((r) => setProducts(r.data.data || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)
  );

  const addItem = () => setItems([...items, { productId: '', description: '', qty: 1, unitPrice: 0, tax: 18 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const updateItem = (i: number, key: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: value };
    if (key === 'productId' && value) {
      const p = products.find((p) => p.id === value);
      if (p) { updated[i].description = p.name; updated[i].unitPrice = parseFloat(p.sellingPrice.toString()); }
    }
    setItems(updated);
  };

  const lineTotal = (item: LineItem) => { const sub = item.qty * item.unitPrice; return sub + sub * (item.tax / 100); };
  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const taxTotal = items.reduce((s, it) => s + it.qty * it.unitPrice * (it.tax / 100), 0);
  const grandTotal = subtotal + taxTotal - discount;

  const handleSaveCustomer = async () => {
    if (!newCust.name || !newCust.phone) { toast.error('Name and phone are required'); return; }
    setSavingCust(true);
    try {
      const { data } = await api.post('/customers', newCust);
      setCustomers((prev) => [data, ...prev]);
      setCustomerId(data.id);
      setNewCustModal(false);
      setNewCust({ name: '', phone: '', email: '' });
      toast.success('Customer added');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingCust(false); }
  };

  const handleSaveProduct = async () => {
    if (!newProd.name || !newProd.sku || !newProd.sellingPrice) { toast.error('Name, SKU, and selling price required'); return; }
    setSavingProd(true);
    try {
      const { data } = await api.post('/products', { ...newProd, sellingPrice: parseFloat(newProd.sellingPrice), purchasePrice: parseFloat(newProd.purchasePrice || '0'), stockQty: parseInt(newProd.stockQty || '0') });
      setProducts((prev) => [data, ...prev]);
      setNewProdModal(false);
      setNewProd({ name: '', sku: '', sellingPrice: '', purchasePrice: '0', stockQty: '0', category: '' });
      toast.success('Product added');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingProd(false); }
  };

  const handleSubmit = async () => {
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (items.some((it) => !it.description.trim())) { toast.error('All items need a description'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/invoices', { customerId, discount, items });
      toast.success(`Invoice ${data.number} created!`);
      router.push(`/invoices/${data.id}`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="mb-4"><Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link></div>
      <PageHeader title="New Invoice" subtitle="Create a new sales invoice" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Customer</h2>
              <button onClick={() => setNewCustModal(true)} className="btn-ghost btn-sm text-blue-600">
                <UserPlus className="w-3.5 h-3.5" />Add New
              </button>
            </div>
            <input className="input mb-2" placeholder="Search by name or phone…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer *</option>
              {filteredCustomers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>

          {/* Items */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-gray-900">Line Items</h2>
              <div className="flex gap-2">
                <button onClick={() => setNewProdModal(true)} className="btn-ghost btn-sm text-blue-600"><PackagePlus className="w-3.5 h-3.5" />New Product</button>
                <button onClick={addItem} className="btn-secondary btn-sm"><Plus className="w-3 h-3" />Add Item</button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2 sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Product (optional)</label>
                      <select className="input text-xs" value={item.productId} onChange={(e) => updateItem(i, 'productId', e.target.value)}>
                        <option value="">Custom item</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQty})</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Description *</label>
                      <input className="input text-xs" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Item description" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Qty</label>
                      <input className="input text-xs" type="number" min="1" value={item.qty} onChange={(e) => updateItem(i, 'qty', parseInt(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Unit Price</label>
                      <input className="input text-xs" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Tax %</label>
                      <input className="input text-xs" type="number" min="0" max="100" value={item.tax} onChange={(e) => updateItem(i, 'tax', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-700">{formatCurrency(lineTotal(item))}</span>
                      {items.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="card sticky top-4">
            <h2 className="font-bold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Discount</span>
                <input className="input w-28 text-right text-sm py-1.5" type="number" min="0" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                <span>Total</span><span className="text-blue-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full py-3">
              {saving ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creating…</span> : '✓ Create Invoice'}
            </button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <Modal open={newCustModal} onClose={() => setNewCustModal(false)} title="Add New Customer" size="sm">
        <div className="space-y-4">
          <FormField label="Full Name" required><input className="input" value={newCust.name} onChange={(e) => setNewCust({...newCust, name:e.target.value})} placeholder="John Doe" /></FormField>
          <FormField label="Phone" required><input className="input" value={newCust.phone} onChange={(e) => setNewCust({...newCust, phone:e.target.value})} placeholder="+91 9999999999" /></FormField>
          <FormField label="Email"><input className="input" type="email" value={newCust.email} onChange={(e) => setNewCust({...newCust, email:e.target.value})} placeholder="john@example.com" /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setNewCustModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveCustomer} disabled={savingCust} className="btn-primary">{savingCust ? 'Adding…' : 'Add Customer'}</button>
          </div>
        </div>
      </Modal>

      {/* New Product Modal */}
      <Modal open={newProdModal} onClose={() => setNewProdModal(false)} title="Add New Product" size="sm">
        <div className="space-y-4">
          <FormField label="Product Name" required><input className="input" value={newProd.name} onChange={(e) => setNewProd({...newProd, name:e.target.value})} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="SKU" required><input className="input" value={newProd.sku} onChange={(e) => setNewProd({...newProd, sku:e.target.value})} /></FormField>
            <FormField label="Category"><input className="input" value={newProd.category} onChange={(e) => setNewProd({...newProd, category:e.target.value})} /></FormField>
            <FormField label="Selling Price" required><input className="input" type="number" min="0" step="0.01" value={newProd.sellingPrice} onChange={(e) => setNewProd({...newProd, sellingPrice:e.target.value})} /></FormField>
            <FormField label="Purchase Price"><input className="input" type="number" min="0" step="0.01" value={newProd.purchasePrice} onChange={(e) => setNewProd({...newProd, purchasePrice:e.target.value})} /></FormField>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setNewProdModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveProduct} disabled={savingProd} className="btn-primary">{savingProd ? 'Adding…' : 'Add Product'}</button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
