'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowLeft, UserPlus } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, FormField, Modal } from '@/components/ui';
import { getErrorMessage, formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import Link from 'next/link';

interface Part { productId: string; qty: number; cost: number; }
interface Customer { id: string; name: string; phone: string; }
interface Product { id: string; name: string; sellingPrice: number; stockQty: number; }
interface Technician { id: string; name: string; }

const DEVICE_TYPES = ['Smartphone','Tablet','Laptop','Desktop','Smartwatch','Gaming Console','Other'];
const EMPTY_FORM = { customerId:'', deviceType:'Smartphone', brand:'', model:'', serialNumber:'', issueDescription:'', technicianId:'', estimatedCost:'' };

export default function NewRepairPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [parts, setParts] = useState<Part[]>([]);

  // Inline customer creation
  const [newCustModal, setNewCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name:'', phone:'', email:'' });
  const [savingCust, setSavingCust] = useState(false);

  useEffect(() => {
    api.get('/customers?limit=500').then((r) => setCustomers(r.data.data||[])).catch(()=>{});
    api.get('/products?limit=500').then((r) => setProducts(r.data.data||[])).catch(()=>{});
    api.get('/auth/users').then((r) => setTechnicians(r.data||[])).catch(()=>{});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch));

  const addPart = () => setParts([...parts, { productId:'', qty:1, cost:0 }]);
  const removePart = (i: number) => setParts(parts.filter((_,idx) => idx !== i));
  const updatePart = (i: number, key: keyof Part, value: string|number) => {
    const updated = [...parts];
    updated[i] = { ...updated[i], [key]: value };
    if (key === 'productId' && value) { const p = products.find((p) => p.id === value); if (p) updated[i].cost = p.sellingPrice; }
    setParts(updated);
  };

  const handleSaveCustomer = async () => {
    if (!newCust.name || !newCust.phone) { toast.error('Name and phone required'); return; }
    setSavingCust(true);
    try {
      const { data } = await api.post('/customers', newCust);
      setCustomers((prev) => [data, ...prev]);
      set('customerId', data.id);
      setNewCustModal(false);
      setNewCust({ name:'', phone:'', email:'' });
      toast.success('Customer added');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingCust(false); }
  };

  const handleSubmit = async () => {
    if (!form.customerId) { toast.error('Please select a customer'); return; }
    if (!form.brand.trim()) { toast.error('Brand is required'); return; }
    if (!form.model.trim()) { toast.error('Model is required'); return; }
    if (!form.issueDescription.trim()) { toast.error('Issue description is required'); return; }
    if (parts.some((p) => !p.productId)) { toast.error('All parts must have a product selected'); return; }
    setSaving(true);
    try {
      const payload = { ...form, technicianId: form.technicianId || undefined, estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined, serialNumber: form.serialNumber || undefined, parts: parts.length ? parts : undefined };
      const { data } = await api.post('/repairs', payload);
      toast.success(`Repair job ${data.jobId} created!`);
      router.push(`/repairs/${data.id}`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const partsTotal = parts.reduce((s,p) => s + p.qty * p.cost, 0);

  return (
    <AppShell>
      <div className="mb-4"><Link href="/repairs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link></div>
      <PageHeader title="New Repair Job" subtitle="Log a device for service" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Customer</h2>
              <button onClick={() => setNewCustModal(true)} className="btn-ghost btn-sm text-blue-600"><UserPlus className="w-3.5 h-3.5" />Add New</button>
            </div>
            <input className="input mb-2" placeholder="Search by name or phone…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <select className="input" value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
              <option value="">Select customer *</option>
              {filteredCustomers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>

          {/* Device */}
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-4">Device Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Device Type *">
                <select className="input" value={form.deviceType} onChange={(e) => set('deviceType', e.target.value)}>
                  {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Brand *"><input className="input" placeholder="Apple, Samsung…" value={form.brand} onChange={(e) => set('brand', e.target.value)} /></FormField>
              <FormField label="Model *"><input className="input" placeholder="iPhone 15, Galaxy S24…" value={form.model} onChange={(e) => set('model', e.target.value)} /></FormField>
              <FormField label="Serial Number"><input className="input" placeholder="Optional" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} /></FormField>
            </div>
            <div className="mt-4">
              <FormField label="Issue Description *">
                <textarea className="input resize-none" rows={3} placeholder="Describe the problem…" value={form.issueDescription} onChange={(e) => set('issueDescription', e.target.value)} />
              </FormField>
            </div>
          </div>

          {/* Parts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Parts Required</h2>
              <button onClick={addPart} className="btn-secondary btn-sm"><Plus className="w-3 h-3" />Add Part</button>
            </div>
            {parts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No parts. Click Add Part if components are needed.</p>
            ) : (
              <div className="space-y-3">
                {parts.map((part, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Product</label>
                        <select className="input text-xs" value={part.productId} onChange={(e) => updatePart(i,'productId',e.target.value)}>
                          <option value="">Select product</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQty})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Qty</label>
                        <input className="input text-xs" type="number" min="1" value={part.qty} onChange={(e) => updatePart(i,'qty',parseInt(e.target.value)||1)} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Cost Each</label>
                        <input className="input text-xs" type="number" min="0" step="0.01" value={part.cost} onChange={(e) => updatePart(i,'cost',parseFloat(e.target.value)||0)} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-blue-700">{formatCurrency(part.qty*part.cost)}</span>
                      <button onClick={() => removePart(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card sticky top-4 space-y-4">
            <h2 className="font-bold text-gray-900">Assignment & Cost</h2>
            <FormField label="Assign Technician">
              <select className="input" value={form.technicianId} onChange={(e) => set('technicianId', e.target.value)}>
                <option value="">Unassigned</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Estimated Cost">
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.estimatedCost} onChange={(e) => set('estimatedCost', e.target.value)} />
            </FormField>
            {parts.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 text-sm flex justify-between">
                <span className="text-gray-600">Parts total</span>
                <span className="font-bold text-blue-700">{formatCurrency(partsTotal)}</span>
              </div>
            )}
            <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full py-3">
              {saving ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creating…</span> : '✓ Create Repair Job'}
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
    </AppShell>
  );
}
