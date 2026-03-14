'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, FileText, Receipt, LogOut } from 'lucide-react';
import { logoutUser } from '@/app/actions/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/bdr-portal', icon: Home },
  { label: 'Monthly Report', href: '/bdr-portal/reports', icon: FileText },
  { label: 'Expenses', href: '/bdr-portal/expenses', icon: Receipt },
];

interface BDRPortalSidebarProps {
  bdrName: string;
  userName: string;
}

export function BDRPortalSidebar({ bdrName, userName }: BDRPortalSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-gray-200 bg-white">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
          <Link href="/bdr-portal" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {bdrName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-lg font-bold text-gray-900 truncate block">BDR Portal</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/bdr-portal' && pathname.startsWith(item.href + '/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon
                  className={cn(
                    'mr-3 h-4 w-4',
                    isActive ? 'text-emerald-700' : 'text-gray-400'
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-medium text-sm">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500">BDR</p>
            </div>
          </div>
          <form action={logoutUser}>
            <button
              type="submit"
              className="flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
