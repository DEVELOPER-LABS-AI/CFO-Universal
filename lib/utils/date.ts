import { format, parseISO } from 'date-fns';

export function formatDate(date: Date | string | number, formatStr: string = 'MMM d, yyyy'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(dateObj, formatStr);
  } catch {
    return 'Invalid Date';
  }
}

export function formatDateForFilename(date: Date | string | number = new Date()): string {
  return formatDate(date, 'yyyy-MM-dd');
}
