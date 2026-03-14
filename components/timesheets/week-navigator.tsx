'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeekNavigatorProps {
  /** ISO date string (YYYY-MM-DD) of the current week's Monday. */
  currentMonday: string;
  /** Callback when user navigates to a different week. Receives the new Monday. */
  onWeekChange: (monday: string) => void;
  /** Whether to enforce a 2-week lookback limit. */
  enforceLookback?: boolean;
}

/** Get the Monday of the week for a given date. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatDateRange(monday: string): string {
  const start = new Date(monday + 'T00:00:00Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function WeekNavigator({
  currentMonday,
  onWeekChange,
  enforceLookback = true,
}: WeekNavigatorProps) {
  const current = new Date(currentMonday + 'T00:00:00Z');
  const today = new Date();
  const todayMonday = getMonday(today);
  const twoWeeksAgo = new Date(todayMonday);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  const isCurrentWeek = toISODate(current) === toISODate(todayMonday);
  const canGoBack = !enforceLookback || current > twoWeeksAgo;
  const canGoForward = current < todayMonday;

  function goPrev() {
    const prev = new Date(current);
    prev.setUTCDate(prev.getUTCDate() - 7);
    onWeekChange(toISODate(prev));
  }

  function goNext() {
    const next = new Date(current);
    next.setUTCDate(next.getUTCDate() + 7);
    onWeekChange(toISODate(next));
  }

  function goToCurrentWeek() {
    onWeekChange(toISODate(todayMonday));
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={goPrev}
        disabled={!canGoBack}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="min-w-[200px] text-center">
        <span className="text-sm font-medium">
          {formatDateRange(currentMonday)}
        </span>
        {isCurrentWeek && (
          <span className="ml-2 text-xs text-emerald-600 font-medium">Current Week</span>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={goNext}
        disabled={!canGoForward}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentWeek && (
        <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
          Today
        </Button>
      )}
    </div>
  );
}
