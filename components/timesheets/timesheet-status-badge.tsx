'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const statusConfig: Record<TimesheetStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  },
  SUBMITTED: {
    label: 'Submitted',
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-700 hover:bg-red-100',
  },
};

interface TimesheetStatusBadgeProps {
  status: TimesheetStatus;
  className?: string;
}

export function TimesheetStatusBadge({ status, className }: TimesheetStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
