'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './status-badge';

/**
 * Circular gauge component displaying organization-wide utilization rate.
 * Uses SVG arc to render a progress ring with color coding based on status.
 */

interface UtilizationGaugeProps {
  /** Utilization rate as a percentage (0-100). */
  utilizationRate: number;
  /** Target utilization rate for display. */
  targetRate: number;
  /** Current status derived from thresholds. */
  status: 'on_target' | 'warning' | 'critical';
  /** Total billable hours in the period. */
  billableHours: number;
  /** Total available hours in the period. */
  availableHours: number;
}

/** Map status to SVG stroke color. */
const STATUS_COLORS: Record<string, string> = {
  on_target: '#22c55e', // green-500
  warning: '#eab308',   // yellow-500
  critical: '#ef4444',  // red-500
};

export function UtilizationGauge({
  utilizationRate,
  targetRate,
  status,
  billableHours,
  availableHours,
}: UtilizationGaugeProps) {
  // SVG circle parameters
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(Math.max(utilizationRate, 0), 100);
  const offset = circumference - (clampedRate / 100) * circumference;
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.on_target;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Organization Utilization
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {/* SVG Gauge */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
          >
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted/20"
            />
            {/* Progress arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums">
              {clampedRate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              Target: {targetRate}%
            </span>
          </div>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} />

        {/* Hours summary */}
        <div className="flex gap-6 text-sm text-muted-foreground">
          <div className="text-center">
            <p className="font-semibold text-foreground tabular-nums">
              {billableHours.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </p>
            <p className="text-xs">Billable</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground tabular-nums">
              {availableHours.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </p>
            <p className="text-xs">Available</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
