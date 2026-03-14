'use client';

import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { Calendar, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCapTableAsOfDate } from '@/app/actions/cap-table';

interface PointInTimeSelectorProps {
  /** Callback invoked with the historical cap table data after a successful fetch. */
  onDateSelect: (data: any) => void;
  /** Callback invoked to reset back to the current/live cap table view. */
  onReset: () => void;
  /** Whether the view is currently showing historical data. */
  isHistorical: boolean;
}

/**
 * Compact inline selector for viewing the cap table as of a specific past date.
 * Renders a date input, a "View as of" button, and a conditional "Reset to current" button.
 */
export function PointInTimeSelector({
  onDateSelect,
  onReset,
  isHistorical,
}: PointInTimeSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState('');

  /** Fetch the cap table snapshot for the selected date via the server action. */
  function handleViewAsOf() {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    startTransition(async () => {
      try {
        const data = await getCapTableAsOfDate({ date: selectedDate });
        onDateSelect(data);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || 'Failed to load historical cap table');
      }
    });
  }

  /** Reset to the live view and clear the selected date. */
  function handleReset() {
    setSelectedDate('');
    onReset();
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        max={new Date().toISOString().split('T')[0]}
        className="w-40"
        disabled={isPending}
        aria-label="Point-in-time date"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleViewAsOf}
        disabled={isPending || !selectedDate}
      >
        {isPending ? 'Loading...' : 'View as of'}
      </Button>
      {isHistorical && (
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isPending}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset to current
        </Button>
      )}
    </div>
  );
}
