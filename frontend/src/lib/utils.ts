export function formatCurrency(amount: number | string, symbol?: string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return `${symbol || '₹'}0.00`;
  const sym = symbol || (
    typeof window !== 'undefined'
      ? (JSON.parse(localStorage.getItem('phoenix_settings') || '{}').currency_symbol || '₹')
      : '₹'
  );
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const STATUS_COLORS: Record<string, string> = {
  PAID: 'badge-green', UNPAID: 'badge-red', PARTIAL: 'badge-yellow', CANCELLED: 'badge-gray',
  RECEIVED: 'badge-blue', DIAGNOSING: 'badge-yellow', WAITING_FOR_PARTS: 'badge-orange',
  IN_REPAIR: 'badge-blue', READY: 'badge-green', DELIVERED: 'badge-gray',
};

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const e = error as { response?: { data?: { error?: string; details?: string[]; message?: string } } };
    if (e.response?.data?.details?.length) return e.response.data.details.join('. ');
    if (e.response?.data?.error) return e.response.data.error;
    if (e.response?.data?.message) return e.response.data.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

/**
 * Trigger a browser file download via authenticated fetch.
 * Returns a promise that resolves when download starts or rejects with an error message.
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('phoenix_token') : null;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;

  const res = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { const body = await res.json(); msg = body.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get('content-disposition');
  let fname = filename;
  if (!fname && contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match) fname = match[1];
  }
  fname = fname || fullUrl.split('/').pop() || 'download.pdf';

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(objectUrl); document.body.removeChild(a); }, 1000);
}
