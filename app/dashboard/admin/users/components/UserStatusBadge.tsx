import { Badge } from '@/components/ui/badge'
import type { UserStatus } from '@prisma/client'

interface UserStatusBadgeProps {
  status: UserStatus | null
}

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  // Handle null status (fallback to ACTIVE)
  const effectiveStatus = status || 'ACTIVE'

  const variants = {
    ACTIVE: 'default',
    INACTIVE: 'outline',
  } as const

  const labels = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
  }

  const colors = {
    ACTIVE: 'text-green-600 bg-green-50 border-green-200',
    INACTIVE: 'text-gray-600 bg-gray-50 border-gray-200',
  }

  return (
    <Badge variant={variants[effectiveStatus]} className={colors[effectiveStatus]}>
      {labels[effectiveStatus]}
    </Badge>
  )
}
