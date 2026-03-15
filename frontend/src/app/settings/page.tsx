'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, Input, Spinner } from '@/components/ui/components';
import { Save, Upload, Building2, FileText, MessageCircle, Cpu, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Image from 'next/image';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

type Tab = 'business' | 'invoice' | 'whatsapp' | 'meta';

export default function SettingsPage() {
  const { data, isLoading, mutate } = useSWR('/settings', fetcher);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('business');
  const [metaToken, setMetaToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data);
      // Cache currency for frontend use
      if (typeof window !== 'undefined' && data.currency_symbol) {
        const cached = JSON.parse(localStorage.getItem('phoenix_settings') || '{}');
        localStorage.setItem('phoenix_settings', JSON.stringify({ ...cached, currency_symbol: data.currency_symbol }));
      }
    }
  }, [data]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success('Settings saved');
      mutate();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('logo', logoFile);
      const { data: result } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo uploaded');
      setForm((f) => ({ ...f, logo_url: result.logoUrl }));
      mutate();
      setLogoFile(null);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setUploading(false); }
  }

  async function saveMetaToken() {
    if (!metaToken.trim()) { toast.error('Enter the access token'); return; }
    setSavingToken(true);
    try {
      await api.put('/settings/meta-token', { meta_access_token: metaToken });
      toast.success('Meta access token saved securely');
      setMetaToken('');
      mutate();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSavingToken(false); }
  }

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    </AppShell>
  );

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'invoice', label: 'Invoice & Logo', icon: FileText },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'meta', label: 'Meta API', icon: Cpu },
  ];

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Configure your business details and integrations" />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={save} className="space-y-6 max-w-2xl">

        {/* ── Business Info ─────────────────────────────────── */}
        {activeTab === 'business' && (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Business Information</h2>
            <Input label="Business Name" value={form.business_name || ''} onChange={(e) => set('business_name', e.target.value)} placeholder="Your business name" />
            <Input label="Address" value={form.business_address || ''} onChange={(e) => set('business_address', e.target.value)} placeholder="Full business address" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Phone" value={form.business_phone || ''} onChange={(e) => set('business_phone', e.target.value)} placeholder="+91 9999999999" />
              <Input label="Email" type="email" value={form.business_email || ''} onChange={(e) => set('business_email', e.target.value)} placeholder="info@business.com" />
            </div>
            <Input label="GST Number" value={form.gst_number || ''} onChange={(e) => set('gst_number', e.target.value)} placeholder="GSTIN0000000000" />
            <Input label="Timezone" value={form.timezone || 'Asia/Kolkata'} onChange={(e) => set('timezone', e.target.value)} placeholder="Asia/Kolkata" />
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── Invoice & Logo ────────────────────────────────── */}
        {activeTab === 'invoice' && (
          <div className="space-y-6">
            <div className="card space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Invoice Settings</h2>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Invoice Prefix" value={form.invoice_prefix || 'INV'} onChange={(e) => set('invoice_prefix', e.target.value)} placeholder="INV" />
                <Input label="Default Tax (%)" type="number" min="0" max="100" value={form.default_tax || '18'} onChange={(e) => set('default_tax', e.target.value)} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Currency Symbol</label>
                  <select className="input" value={form.currency_symbol || '₹'} onChange={(e) => set('currency_symbol', e.target.value)}>
                    <option value="₹">₹ INR</option>
                    <option value="$">$ USD</option>
                    <option value="€">€ EUR</option>
                    <option value="£">£ GBP</option>
                    <option value="AED">AED</option>
                    <option value="SAR">SAR</option>
                    <option value="QAR">QAR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer</label>
                <textarea className="input resize-none" rows={2} value={form.receipt_footer || ''} onChange={(e) => set('receipt_footer', e.target.value)} placeholder="Thank you for your business!" />
                <p className="text-xs text-gray-400 mt-1">Appears at the bottom of every invoice and job card PDF</p>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Business Logo</h2>
              {form.logo_url && (
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <Image
                    src={`${process.env.NEXT_PUBLIC_API_URL}${form.logo_url}`}
                    alt="Business logo"
                    className="h-16 object-contain"
                    width={100}
                    height={100}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Current logo</p>
                    <p className="text-xs text-gray-400 mt-0.5">Appears on invoices and job cards</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-sm file:font-medium file:text-gray-700 file:bg-white file:hover:bg-gray-50 file:cursor-pointer"
                />
                {logoFile && (
                  <button type="button" className="btn-secondary btn-sm" onClick={uploadLogo} disabled={uploading}>
                    <Upload className="w-3.5 h-3.5" />{uploading ? 'Uploading…' : 'Upload Logo'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">JPEG, PNG or WebP · Max 5MB · Recommended: 300×100px</p>
            </div>
          </div>
        )}

        {/* ── WhatsApp ──────────────────────────────────────── */}
        {activeTab === 'whatsapp' && (
          <div className="card space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-700">WhatsApp Sharing</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  When you share an invoice or repair job, the system opens <strong>wa.me</strong> with a
                  pre-filled message and the PDF is saved with the customer's name and document number
                  (e.g. <code className="bg-gray-100 rounded px-1">John_Doe-INV-00001.pdf</code>).
                  Download the PDF and attach it manually before sending.
                </p>
              </div>
            </div>

            <Input
              label="WhatsApp Business Phone (optional)"
              value={form.whatsapp_phone || ''}
              onChange={(e) => set('whatsapp_phone', e.target.value)}
              placeholder="+91 9999999999"
            />
            <p className="text-xs text-gray-400 -mt-3">
              Used in outgoing message footers if set. Must include country code.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Message Template</label>
              <textarea
                className="input resize-none font-mono text-xs"
                rows={6}
                value={form.whatsapp_message_template_invoice || ''}
                onChange={(e) => set('whatsapp_message_template_invoice', e.target.value)}
                placeholder="Leave blank to use the default template"
              />
              <p className="text-xs text-gray-400 mt-1">
                Available variables: <code className="bg-gray-100 rounded px-1">{'{customerName}'}</code>{' '}
                <code className="bg-gray-100 rounded px-1">{'{invoiceNumber}'}</code>{' '}
                <code className="bg-gray-100 rounded px-1">{'{totalAmount}'}</code>{' '}
                <code className="bg-gray-100 rounded px-1">{'{businessName}'}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repair Message Template</label>
              <textarea
                className="input resize-none font-mono text-xs"
                rows={5}
                value={form.whatsapp_message_template_repair || ''}
                onChange={(e) => set('whatsapp_message_template_repair', e.target.value)}
                placeholder="Leave blank to use the default template"
              />
              <p className="text-xs text-gray-400 mt-1">
                Available variables: <code className="bg-gray-100 rounded px-1">{'{customerName}'}</code>{' '}
                <code className="bg-gray-100 rounded px-1">{'{jobId}'}</code>{' '}
                <code className="bg-gray-100 rounded px-1">{'{status}'}</code>{' '}
                <code className="bg-gray-100 rounded px-1">{'{deviceInfo}'}</code>
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── Meta API ──────────────────────────────────────── */}
        {activeTab === 'meta' && (
          <div className="space-y-6">
            <div className="card space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Meta Cloud API Integration</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure your Meta (Facebook) WhatsApp Business Cloud API credentials here.
                    When <strong>Meta API Enabled</strong> is set to <em>Yes</em>, messages will be sent
                    automatically via the API instead of opening wa.me.
                    Leave disabled to continue using the manual wa.me sharing flow.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <ShieldCheck className="w-4 h-4 inline mr-1 text-amber-600" />
                <strong>Note:</strong> The Meta Access Token is stored securely and is never returned in
                full over the API (only masked). To update the token, use the separate field below.
              </div>

              <div className="flex items-center gap-3">
                <label className="block text-sm font-medium text-gray-700">Meta API Enabled</label>
                <select
                  className="input w-28"
                  value={form.meta_api_enabled || '0'}
                  onChange={(e) => set('meta_api_enabled', e.target.value)}
                >
                  <option value="0">Disabled</option>
                  <option value="1">Enabled</option>
                </select>
              </div>

              <Input
                label="WhatsApp Business Account ID (WABA ID)"
                value={form.meta_waba_id || ''}
                onChange={(e) => set('meta_waba_id', e.target.value)}
                placeholder="123456789012345"
              />
              <Input
                label="Phone Number ID"
                value={form.meta_phone_number_id || ''}
                onChange={(e) => set('meta_phone_number_id', e.target.value)}
                placeholder="987654321012345"
              />
              <Input
                label="Webhook Verify Token"
                value={form.meta_webhook_verify_token || ''}
                onChange={(e) => set('meta_webhook_verify_token', e.target.value)}
                placeholder="your_custom_verify_token"
              />
              <p className="text-xs text-gray-400 -mt-3">
                Configure this as your webhook verify token in the Meta Developer Console.
              </p>

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Separate secure token update */}
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Update Access Token</h3>
              <p className="text-xs text-gray-500">
                Enter your permanent system-user access token from the Meta Business Manager.
                The existing token is: <code className="bg-gray-100 rounded px-1">{form.meta_access_token || 'not set'}</code>
              </p>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="EAAxxxxxxxxxxxxxxxxxx..."
                  value={metaToken}
                  onChange={(e) => setMetaToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveMetaToken}
                  disabled={savingToken || !metaToken.trim()}
                >
                  <ShieldCheck className="w-4 h-4" />{savingToken ? 'Saving…' : 'Save Token Securely'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </AppShell>
  );
}
