'use client';

/**
 * T025: Assignment Timeline Component
 * Displays staff assignments as a visual timeline with cards showing
 * client name, allocation percentage, date range, and active/ended status.
 * Highlights bench duration when staff is currently unassigned.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Assignment {
  /** Assignment ID */
  id: string;
  /** Client name */
  client_name: string;
  /** Allocation percentage (0-100) */
  allocation_percentage: number;
  /** Assignment start date (ISO string) */
  start_date: string;
  /** Assignment end date (ISO string) or null if ongoing */
  end_date: string | null;
  /** Whether the assignment is currently active */
  is_active: boolean;
}

interface AssignmentTimelineProps {
  /** List of assignments to display */
  assignments: Assignment[];
  /** Number of consecutive days on bench, or null if currently assigned */
  benchDurationDays: number | null;
  /** ISO date string of the last ended assignment, or null */
  lastAssignmentEnd: string | null;
}

/**
 * Format a date string for display.
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculate duration label between two dates.
 */
function getDurationLabel(start: string, end: string | null): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return `${diffDays}d`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`;
}

export function AssignmentTimeline({
  assignments,
  benchDurationDays,
  lastAssignmentEnd,
}: AssignmentTimelineProps) {
  // Sort by start_date descending (most recent first)
  const sorted = [...assignments].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  const isOnBench = benchDurationDays !== null && benchDurationDays >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Assignment Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Bench duration banner */}
        {isOnBench && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-800">Currently on Bench</p>
                <p className="text-sm text-amber-700">
                  {benchDurationDays === 0
                    ? 'Just became unassigned'
                    : `${benchDurationDays} day${benchDurationDays !== 1 ? 's' : ''} without billable assignment`}
                </p>
              </div>
              {lastAssignmentEnd && (
                <p className="text-xs text-amber-600">
                  Last assignment ended {formatDate(lastAssignmentEnd)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Assignments list */}
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No assignments found for this staff member.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((assignment) => (
              <div
                key={assignment.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  assignment.is_active
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {assignment.client_name}
                    </p>
                    <Badge
                      variant={assignment.is_active ? 'default' : 'secondary'}
                      className={
                        assignment.is_active
                          ? 'bg-green-600 hover:bg-green-700'
                          : ''
                      }
                    >
                      {assignment.is_active ? 'Active' : 'Ended'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(assignment.start_date)}
                    {' - '}
                    {assignment.end_date
                      ? formatDate(assignment.end_date)
                      : 'Present'}
                    <span className="mx-1 text-gray-400">|</span>
                    {getDurationLabel(assignment.start_date, assignment.end_date)}
                  </p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-lg font-semibold">
                    {assignment.allocation_percentage.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">allocation</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
