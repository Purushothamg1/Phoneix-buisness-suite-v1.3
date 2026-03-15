import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
          <Image src="/logo.png" alt="Phoenix" width={52} height={52} className="object-contain" />
        </div>
        <h1 className="text-7xl font-black text-white mb-3">404</h1>
        <p className="text-xl text-blue-200 mb-2">Page not found</p>
        <p className="text-sm text-blue-300/70 mb-10">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/dashboard" className="btn-primary px-8 py-3">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
