/**
 * Currency formatting and rate normalization utilities
 */

/**
 * Normalize any rate to a monthly cost based on rate type.
 * HOURLY: 22 working days x 8 hours = 176 hours/month
 * DAILY: 22 working days/month
 * MONTHLY: pass-through
 */
export function toMonthlyCost(rate: number, rateType: string): number {
  switch (rateType) {
    case 'HOURLY': return rate * 176;
    case 'DAILY': return rate * 22;
    case 'MONTHLY': return rate;
    default: return rate;
  }
}

/**
 * Normalize any rate to an hourly cost based on rate type.
 * HOURLY: pass-through
 * DAILY: rate / 8 (standard daily hours)
 * MONTHLY: rate / 176 (22 working days x 8 hours)
 * VARIABLE: treat as MONTHLY
 */
export function toHourlyCost(rate: number, rateType: string): number {
  switch (rateType) {
    case 'HOURLY': return rate;
    case 'DAILY': return rate / 8;
    case 'MONTHLY': return rate / 176;
    case 'VARIABLE': return rate / 176;
    default: return rate / 176;
  }
}

export function formatCurrency(value: number | string, currency: string = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

export function formatCurrencyCompact(value: number | string, currency: string = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '$0';
  }

  // For values over 1M, use compact notation
  if (Math.abs(numValue) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(numValue);
  }

  // For values over 10K, use compact notation
  if (Math.abs(numValue) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  }

  // For smaller values, use standard formatting
  return formatCurrency(numValue, currency);
}
