'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Settings,
  Briefcase,
  Users,
  CreditCard,
  Building2,
  LayoutDashboard,
  Zap,
  Database,
  ChevronDown,
  LineChart,
  FileText,
  DollarSign,
  Target,
  FolderKanban,
  PieChart,
  Mail,
  Activity,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth/helpers'

interface SubItem {
  label: string
  href: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  disabled?: boolean
  badge?: string
  subItems?: SubItem[]
}

interface NavGroup {
  label: string
  collapsible?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
    ],
  },
  {
    label: 'Revenue',
    collapsible: true,
    items: [
      { label: 'Portfolio', href: '/dashboard/portfolio', icon: LayoutDashboard },
      { label: 'Clients', href: '/dashboard/clients', icon: Briefcase },
      { label: 'Services', href: '/dashboard/services', icon: Settings },
    ],
  },
  {
    label: 'Expenses',
    collapsible: true,
    items: [
      { label: 'Subscriptions', href: '/dashboard/subscriptions', icon: CreditCard },
      { label: 'Enrichments', href: '/dashboard/enrichments', icon: Zap },
    ],
  },
  {
    label: 'Organization',
    collapsible: true,
    items: [
      { label: 'Staff', href: '/dashboard/staff', icon: Users },
      { label: 'Agencies', href: '/dashboard/agencies', icon: Building2 },
      { label: 'Contractors', href: '/dashboard/contractors', icon: Users },
    ],
  },
  {
    label: 'Insights',
    collapsible: true,
    items: [
      { label: 'Compensation', href: '/dashboard/compensation', icon: DollarSign },
      { label: 'Analytics', href: '/dashboard/analytics', icon: LineChart },
      {
        label: 'Utilization',
        href: '/dashboard/utilization',
        icon: Activity,
        subItems: [
          { label: 'Overview', href: '/dashboard/utilization' },
          { label: 'Bench Report', href: '/dashboard/utilization/bench' },
        ],
      },
      { label: 'CFO Strategist', href: '/dashboard/strategist', icon: Target },
      { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
      { label: 'Cap Table', href: '/dashboard/cap-table', icon: PieChart },
    ],
  },
  {
    label: 'Integrations',
    collapsible: true,
    items: [
      {
        label: 'Mercury',
        href: '/dashboard/integrations/mercury',
        icon: Zap,
        subItems: [
          { label: 'Overview', href: '/dashboard/integrations/mercury' },
          { label: 'Vendor Mapping', href: '/dashboard/integrations/mercury/merchants' },
          { label: 'Expenses', href: '/dashboard/integrations/mercury/expenses' },
        ],
      },
      {
        label: 'Xero',
        href: '/dashboard/integrations/xero',
        icon: Database,
        subItems: [
          { label: 'Overview', href: '/dashboard/integrations/xero' },
          { label: 'Mappings', href: '/dashboard/integrations/xero/mappings' },
        ],
      },
    ],
  },
  {
    label: 'BDR Management',
    collapsible: true,
    items: [
      {
        label: 'BDR Overview',
        href: '/dashboard/bdr',
        icon: DollarSign,
        subItems: [
          { label: 'Dashboard', href: '/dashboard/bdr' },
          { label: 'Pay Plans', href: '/dashboard/bdr/pay-plans' },
          { label: 'Reports', href: '/dashboard/bdr/reports' },
          { label: 'Expenses', href: '/dashboard/bdr/expenses' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    collapsible: true,
    items: [
      { label: 'User Management', href: '/dashboard/admin/users', icon: Users, adminOnly: true },
      { label: 'Agency Invoices', href: '/dashboard/admin/invoices', icon: FileText, adminOnly: true },
      { label: 'Contractor Invoices', href: '/dashboard/admin/contractor-invoices', icon: FileText, adminOnly: true },
      { label: 'Email Logs', href: '/dashboard/admin/email-logs', icon: Mail, adminOnly: true },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, adminOnly: true },
      { label: 'Utilization Settings', href: '/dashboard/settings/utilization', icon: Activity, adminOnly: true },
    ],
  },
]

interface DashboardSidebarProps {
  user: AuthUser
}

const SIDEBAR_STORAGE_KEY = 'devlabs-cfo-sidebar-accordion-state'

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname()

  // Check if any sub-item matches the current path
  const hasActiveSubItem = (item: NavItem) =>
    item.subItems?.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + '/')) ?? false

  // Track which groups and items are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Load saved state from localStorage
    let saved: Record<string, boolean> = {}
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (stored) saved = JSON.parse(stored)
    } catch {
      // SSR or invalid JSON - ignore
    }

    const initial: Record<string, boolean> = { ...saved }

    // Auto-expand groups/items that contain the active path
    for (const group of navGroups) {
      if (group.collapsible) {
        const hasActiveItem = group.items.some(
          (item) => pathname === item.href || pathname.startsWith(item.href + '/')
        )
        if (hasActiveItem) initial[group.label] = true
      }
      for (const item of group.items) {
        if (item.subItems && (pathname.startsWith(item.href) || hasActiveSubItem(item))) {
          initial[item.href] = true
        }
      }
    }
    return initial
  })

  // Persist accordion state to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(expanded))
    } catch {
      // Storage full or unavailable - ignore
    }
  }, [expanded])

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-gray-200 bg-white">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">DL</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                DevLabs CFO
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.adminOnly || user.role === 'ADMIN'
              )
              if (visibleItems.length === 0) return null

              // Collapsible groups: label is the accordion trigger
              if (group.collapsible) {
                const isGroupActive = visibleItems.some(
                  (item) => pathname === item.href || pathname.startsWith(item.href + '/') || hasActiveSubItem(item)
                )
                const isGroupExpanded = expanded[group.label] ?? false

                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleExpand(group.label)}
                      className={cn(
                        'flex items-center w-full px-3 mb-1 text-xs font-semibold uppercase tracking-wider transition-colors',
                        isGroupActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                      )}
                    >
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown className={cn(
                        'h-3 w-3 transition-transform duration-200',
                        isGroupExpanded ? 'rotate-180' : ''
                      )} />
                    </button>
                    <div className={cn(
                      'overflow-hidden transition-all duration-200',
                      isGroupExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    )}>
                      <div className="space-y-0.5">
                        {visibleItems.map((item) => {
                          const Icon = item.icon
                          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                          const isParentActive = pathname.startsWith(item.href) || hasActiveSubItem(item)
                          const isItemExpanded = expanded[item.href] ?? false

                          // Items with sub-menu (e.g., Mercury, Xero)
                          if (item.subItems) {
                            return (
                              <div key={item.href}>
                                <button
                                  onClick={() => toggleExpand(item.href)}
                                  className={cn(
                                    'flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                    isParentActive
                                      ? 'text-blue-700'
                                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                  )}
                                >
                                  <Icon className={cn(
                                    'mr-3 h-4 w-4',
                                    isParentActive ? 'text-blue-700' : 'text-gray-400'
                                  )} />
                                  <span className="flex-1 text-left">{item.label}</span>
                                  <ChevronDown className={cn(
                                    'h-4 w-4 transition-transform duration-200',
                                    isItemExpanded ? 'rotate-180' : '',
                                    isParentActive ? 'text-blue-500' : 'text-gray-400'
                                  )} />
                                </button>
                                <div className={cn(
                                  'overflow-hidden transition-all duration-200',
                                  isItemExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                                )}>
                                  <div className="ml-7 pl-3 border-l border-gray-200 mt-0.5 space-y-0.5">
                                    {item.subItems.map((sub) => {
                                      const isSubActive = pathname === sub.href || (sub.href !== item.href && pathname.startsWith(sub.href + '/'))
                                      return (
                                        <Link
                                          key={sub.href}
                                          href={sub.href}
                                          className={cn(
                                            'block px-3 py-1.5 text-sm rounded-md transition-colors',
                                            isSubActive
                                              ? 'bg-blue-50 text-blue-700 font-medium'
                                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                          )}
                                        >
                                          {sub.label}
                                        </Link>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Regular items
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                isActive
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                              )}
                            >
                              {Icon && <Icon className={cn('mr-3 h-4 w-4', isActive ? 'text-blue-700' : 'text-gray-400')} />}
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={group.label}>
                  <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon
                      const isParentActive = pathname.startsWith(item.href) || hasActiveSubItem(item)
                      const isExactActive =
                        pathname === item.href ||
                        (item.href !== '/dashboard' && !item.subItems && pathname.startsWith(item.href + '/'))
                      const isExpanded = expanded[item.href] ?? false

                      // Items with sub-menu
                      if (item.subItems) {
                        return (
                          <div key={item.href}>
                            <button
                              onClick={() => toggleExpand(item.href)}
                              className={cn(
                                'flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                isParentActive
                                  ? 'text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                              )}
                            >
                              <Icon className={cn(
                                'mr-3 h-4 w-4',
                                isParentActive ? 'text-blue-700' : 'text-gray-400'
                              )} />
                              <span className="flex-1 text-left">{item.label}</span>
                              <ChevronDown className={cn(
                                'h-4 w-4 transition-transform duration-200',
                                isExpanded ? 'rotate-180' : '',
                                isParentActive ? 'text-blue-500' : 'text-gray-400'
                              )} />
                            </button>

                            {/* Sub-items */}
                            <div className={cn(
                              'overflow-hidden transition-all duration-200',
                              isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                            )}>
                              <div className="ml-7 pl-3 border-l border-gray-200 mt-0.5 space-y-0.5">
                                {item.subItems.map((sub) => {
                                  const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                                  return (
                                    <Link
                                      key={sub.href}
                                      href={sub.href}
                                      className={cn(
                                        'block px-3 py-1.5 text-sm rounded-md transition-colors',
                                        isSubActive
                                          ? 'bg-blue-50 text-blue-700 font-medium'
                                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                      )}
                                    >
                                      {sub.label}
                                    </Link>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // Disabled items (coming soon)
                      if (item.disabled) {
                        return (
                          <span
                            key={item.href + item.label}
                            className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed"
                          >
                            <Icon className="mr-3 h-4 w-4 text-gray-300" />
                            {item.label}
                            {item.badge && (
                              <span className="ml-auto text-[10px] font-semibold uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                                {item.badge}
                              </span>
                            )}
                          </span>
                        )
                      }

                      // Regular items (no sub-menu)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                            isExactActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <Icon className={cn(
                            'mr-3 h-4 w-4',
                            isExactActive ? 'text-blue-700' : 'text-gray-400'
                          )} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          {/* User Info */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">
                    {user.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.fullName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
