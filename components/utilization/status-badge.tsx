'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Status type for utilization thresholds.
 * - on_target: meets or exceeds the target rate
 * - warning: below target but above critical threshold
 * - critical: below critical threshold
 */
type UtilizationStatus = 'on_target' | 'warning' | 'critical';

interface StatusBadgeProps {
  /** The utilization status to display. */
  status: UtilizationStatus;
  /** Whether to show the text label. Defaults to true. */
  showLabel?: boolean;
  /** Optional custom label override. */
  label?: string;
  /** Additional CSS classes. */
  className?: string;
}

const STATUS_CONFIG: Record<UtilizationStatus, {
  label: string;
  className: string;
  dotColor: string;
}> = {
  on_target: {
    label: 'On Target',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
    dotColor: 'bg-green-500',
  },
  warning: {
    label: 'Warning',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
    dotColor: 'bg-yellow-500',
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    dotColor: 'bg-red-500',
  },
};

/**
 * Renders a color-coded badge for utilization status.
 * Green for on_target, yellow for warning, red for critical.
 * Includes a small colored dot indicator.
 */
export function StatusBadge({ status, showLabel = true, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.label;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <span
        className={`mr-1.5 h-2 w-2 rounded-full inline-block ${config.dotColor}`}
      />
      {showLabel && displayLabel}
    </Badge>
  );
}
