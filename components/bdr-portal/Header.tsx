'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { BDRPortalSidebar } from './Sidebar';

interface BDRPortalHeaderProps {
  bdrName: string;
  userName: string;
}

export function BDRPortalHeader({ bdrName, userName }: BDRPortalHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-6 lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="text-gray-500 hover:text-gray-700"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/bdr-portal" className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">
              {bdrName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-semibold text-gray-900">BDR Portal</span>
        </Link>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64">
            <BDRPortalSidebar bdrName={bdrName} userName={userName} />
          </div>
        </div>
      )}
    </>
  );
}
