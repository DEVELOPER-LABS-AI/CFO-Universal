'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateProjectRevenue } from '@/app/actions/project-metrics';
import { formatCurrency } from '@/lib/utils/currency';

interface RevenueEntryFormProps {
  projectId: string;
  currentRevenue: number;
  currentMonth: number;
  currentYear: number;
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

/**
 * Form component for entering or updating revenue for a project in a specific month/year.
 * Displays the current saved revenue and allows submitting a new value.
 */
export function RevenueEntryForm({
  projectId,
  currentRevenue,
  currentMonth,
  currentYear,
}: RevenueEntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [amount, setAmount] = useState<string>(
    currentRevenue > 0 ? currentRevenue.toString() : ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  /**
   * Handles form submission by calling the updateProjectRevenue server action
   * and displaying appropriate toast feedback.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid revenue amount.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await updateProjectRevenue({
        project_id: projectId,
        month: selectedMonth,
        year: selectedYear,
        revenue: parsedAmount,
      });

      toast({
        title: 'Revenue updated',
        description: `Revenue for ${MONTHS[selectedMonth - 1].label} ${selectedYear} has been saved.`,
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update revenue. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {currentRevenue > 0
            ? `Current: ${formatCurrency(currentRevenue)}`
            : 'No revenue recorded'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value, 10))}
              >
                <SelectTrigger id="month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                min={2000}
                max={2100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenue">Revenue Amount</Label>
            <Input
              id="revenue"
              type="number"
              step="0.01"
              placeholder="$0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
