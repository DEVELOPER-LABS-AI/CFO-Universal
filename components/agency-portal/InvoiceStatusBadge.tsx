'use client'

import { cn } from '@/lib/utils'

const statusConfig = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  PAID: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700' },
} as const

interface InvoiceStatusBadgeProps {
  status: keyof typeof statusConfig
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
