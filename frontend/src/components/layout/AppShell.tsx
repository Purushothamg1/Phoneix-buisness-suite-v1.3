'use client';
import { useEffect, useCallback, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Image from 'next/image';

interface LayoutContextType { sidebarOpen: boolean; toggleSidebar: () => void; }
export const LayoutContext = createContext<LayoutContextType>({ sidebarOpen: true, toggleSidebar: () => {} });
export const useLayout = () => useContext(LayoutContext);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Restore sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('phoenix_sidebar');
    if (saved !== null) setSidebarOpen(saved === 'open');
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      localStorage.setItem('phoenix_sidebar', next ? 'open' : 'closed');
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  // Cmd+K shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); router.push('/search'); }
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggleSidebar(); }
  }, [router, toggleSidebar]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Phoenix" width={64} height={64} className="w-16 h-16 object-contain rounded-2xl opacity-80" />
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <LayoutContext.Provider value={{ sidebarOpen, toggleSidebar }}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Sidebar */}
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

        {/* Main */}
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
          {/* Mobile top bar */}
          <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 lg:hidden shadow-sm">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Image src="/logo.png" alt="Phoenix" width={28} height={28} className="w-7 h-7 object-contain rounded-lg" />
            <span className="font-bold text-gray-900 text-sm">Phoenix</span>
          </div>

          <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto page-enter">
            {children}
          </div>
        </main>
      </div>
    </LayoutContext.Provider>
  );
}
