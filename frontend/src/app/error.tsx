'use client';
import { useEffect } from 'react';
import Image from 'next/image';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
          <Image src="/logo.png" alt="Phoenix" width={52} height={52} className="object-contain opacity-60" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-blue-200 text-sm mb-8">{error.message || 'An unexpected error occurred. Please try again.'}</p>
        <button onClick={reset} className="btn-primary px-8 py-3">Try Again</button>
      </div>
    </div>
  );
}
