'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { UserNav } from './UserNav'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import type { AuthUser } from '@/lib/auth/helpers'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  user: AuthUser
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* Breadcrumb or Page Title (can be customized later) */}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
          DevLabs CFO
        </h2>
      </div>

      {/* Notification Center */}
      <NotificationCenter />

      {/* User Navigation */}
      <UserNav user={user} />
    </header>
  )
}
