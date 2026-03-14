import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@prisma/client'

interface UserRoleBadgeProps {
  role: UserRole | null
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  // Handle null role (fallback to EXECUTIVE)
  const effectiveRole = role || 'EXECUTIVE'

  const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
    ADMIN: 'destructive',
    EXECUTIVE: 'default',
    ANALYST: 'secondary',
    AGENCY_ADMIN: 'outline',
    CONTRACTOR: 'secondary',
  }

  const labels: Record<string, string> = {
    ADMIN: 'Admin',
    EXECUTIVE: 'Executive',
    ANALYST: 'Analyst',
    AGENCY_ADMIN: 'Agency Admin',
    CONTRACTOR: 'Contractor',
  }

  return (
    <Badge variant={variants[effectiveRole]}>
      {labels[effectiveRole]}
    </Badge>
  )
}
