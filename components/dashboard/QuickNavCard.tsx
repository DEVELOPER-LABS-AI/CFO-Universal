import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LayoutDashboard,
  LineChart,
  Wallet,
  Briefcase,
  Users,
  Building2,
  CreditCard,
  Database,
  Zap,
  UserCheck,
  Settings,
} from 'lucide-react'

interface QuickNavCardProps {
  /** Current user role for admin-gating links. */
  userRole: string
}

const FINANCIAL_LINKS = [
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: LayoutDashboard },
  { href: '/dashboard/analytics', label: 'Analytics', icon: LineChart },
  { href: '/dashboard/compensation', label: 'Compensation', icon: Wallet },
]

const OPERATIONS_LINKS = [
  { href: '/dashboard/clients', label: 'Clients', icon: Briefcase },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
  { href: '/dashboard/agencies', label: 'Agencies', icon: Building2 },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: CreditCard },
]

const INTEGRATION_LINKS = [
  { href: '/dashboard/integrations/xero', label: 'Xero', icon: Database },
  { href: '/dashboard/integrations/mercury', label: 'Mercury', icon: Zap },
]

const ADMIN_LINKS = [
  { href: '/dashboard/admin/users', label: 'User Management', icon: UserCheck },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

/**
 * Compact grouped navigation card for the main dashboard.
 * Replaces the oversized 9-card quick actions grid with a single dense card.
 */
export function QuickNavCard({ userRole }: QuickNavCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Navigation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <NavGroup label="Financial" links={FINANCIAL_LINKS} />
        <NavGroup label="Operations" links={OPERATIONS_LINKS} />
        <NavGroup label="Integrations" links={INTEGRATION_LINKS} />
        {userRole === 'ADMIN' && <NavGroup label="Admin" links={ADMIN_LINKS} />}
      </CardContent>
    </Card>
  )
}

function NavGroup({
  label,
  links,
}: {
  label: string
  links: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-1">
        {links.map(({ href, label: linkLabel, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span>{linkLabel}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
