'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface PeriodPickerProps {
  availablePeriods: { month: number; year: number }[];
  selectedMonth?: number;
  selectedYear?: number;
}

export function PeriodPicker({
  availablePeriods,
  selectedMonth,
  selectedYear,
}: PeriodPickerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const currentValue =
    selectedMonth && selectedYear
      ? `${selectedYear}-${selectedMonth}`
      : 'latest';

  const handleChange = (value: string) => {
    if (value === 'latest') {
      router.push(pathname);
    } else {
      const [year, month] = value.split('-');
      router.push(`${pathname}?month=${month}&year=${year}`);
    }
  };

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="latest">Latest</SelectItem>
        {availablePeriods.map((p) => (
          <SelectItem key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
            {MONTH_NAMES[p.month - 1]} {p.year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
