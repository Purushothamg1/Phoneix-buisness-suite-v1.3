'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import api from '@/lib/api';
import {
  LayoutDashboard, Users, Package, Truck, FileText, Wrench,
  CreditCard, BarChart3, Settings, ArrowUpDown, Search,
  LogOut, UserCog, Activity, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import Image from 'next/image';

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, roles: ['ADMIN','MANAGER','STAFF'] },
  { href: '/customers',     label: 'Customers',     icon: Users,           roles: ['ADMIN','MANAGER','STAFF'] },
  { href: '/products',      label: 'Inventory',     icon: Package,         roles: ['ADMIN','MANAGER'], badge: 'lowStock' },
  { href: '/suppliers',     label: 'Suppliers',     icon: Truck,           roles: ['ADMIN','MANAGER'] },
  { href: '/invoices',      label: 'Invoices',      icon: FileText,        roles: ['ADMIN','MANAGER','STAFF'] },
  { href: '/repairs',       label: 'Repairs',       icon: Wrench,          roles: ['ADMIN','MANAGER','STAFF'] },
  { href: '/payments',      label: 'Payments',      icon: CreditCard,      roles: ['ADMIN','MANAGER'] },
  { href: '/reports',       label: 'Reports',       icon: BarChart3,       roles: ['ADMIN','MANAGER'] },
  { href: '/import-export', label: 'Import/Export', icon: ArrowUpDown,     roles: ['ADMIN','MANAGER'] },
  { href: '/users',         label: 'Users',         icon: UserCog,         roles: ['ADMIN'] },
  { href: '/audit',         label: 'Audit Log',     icon: Activity,        roles: ['ADMIN'] },
  { href: '/settings',      label: 'Settings',      icon: Settings,        roles: ['ADMIN'] },
];

const fetcher = (url: string) => api.get(url).then((r) => r.data);

interface SidebarProps { mobileOpen?: boolean; onMobileClose?: () => void; }

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { sidebarOpen, toggleSidebar } = useLayout();
  const { data: dashboard } = useSWR(user ? '/dashboard' : null, fetcher, { refreshInterval: 120_000, revalidateOnFocus: false });
  const lowStockCount: number = dashboard?.lowStockAlerts || 0;

  const NavContent = () => (
    <>
      {/* Logo / Header */}
      <div className={cn('flex items-center border-b border-slate-700/60 flex-shrink-0', sidebarOpen ? 'gap-3 px-4 py-4' : 'justify-center px-2 py-4')}>
        <div className="relative flex-shrink-0">
          <Image src="/logo.png" alt="Phoenix" width={36} height={36} className="rounded-xl object-contain" />
        </div>
        {sidebarOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-none truncate">Phoenix</p>
            <p className="text-slate-400 text-xs mt-0.5">Business Suite v1.3</p>
          </div>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
          title={sidebarOpen ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {/* Mobile close */}
        {onMobileClose && (
          <button onClick={onMobileClose} className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search */}
      {sidebarOpen && (
        <div className="px-3 py-2 flex-shrink-0">
          <Link href="/search" className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors', pathname === '/search' && 'bg-slate-800 text-white')}>
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-sm">Search</span>
            <kbd className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </Link>
        </div>
      )}
      {!sidebarOpen && (
        <div className="px-2 py-2 flex-shrink-0">
          <Link href="/search" className={cn('flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors', pathname === '/search' && 'bg-slate-800 text-white')} title="Search (⌘K)">
            <Search className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className={cn('flex-1 overflow-y-auto pb-3', sidebarOpen ? 'px-3 space-y-0.5' : 'px-2 space-y-1')}>
        {navItems.filter((item) => !user || item.roles.includes(user.role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = item.badge === 'lowStock' && lowStockCount > 0;
          return sidebarOpen ? (
            <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors', active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {showBadge && !active && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {lowStockCount > 99 ? '99+' : lowStockCount}
                </span>
              )}
            </Link>
          ) : (
            <Link key={item.href} href={item.href} title={item.label} className={cn('relative flex items-center justify-center p-2.5 rounded-xl transition-colors', active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
              <item.icon className="w-4 h-4" />
              {showBadge && <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn('border-t border-slate-700/60 flex-shrink-0', sidebarOpen ? 'px-3 py-3' : 'px-2 py-3')}>
        {sidebarOpen ? (
          <>
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-slate-400 text-xs">{user?.role}</p>
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl text-sm transition-colors">
              <LogOut className="w-4 h-4" />Sign out
            </button>
          </>
        ) : (
          <button onClick={logout} className="flex items-center justify-center w-full p-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn('hidden lg:flex flex-col fixed inset-y-0 left-0 bg-slate-900 z-50 transition-all duration-300 overflow-hidden', sidebarOpen ? 'w-64' : 'w-16')}>
        <NavContent />
      </aside>

      {/* Mobile sidebar */}
      <aside className={cn('lg:hidden flex flex-col fixed inset-y-0 left-0 w-72 bg-slate-900 z-50 transition-transform duration-300', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <NavContent />
      </aside>
    </>
  );
}
