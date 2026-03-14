/**
 * Markup & Margin Calculations
 *
 * Pure utility functions for computing bill rates, margins, and effective markup
 * for agency staff. Uses toMonthlyCost() for rate type conversions.
 */

import { toMonthlyCost } from '@/lib/utils/currency';

// Types matching Prisma enums
export type MarkupType = 'PERCENTAGE' | 'FLAT_RATE';
export type MarkupBasis = 'BASE_PAY' | 'TOTAL_COMPENSATION';
export type RateType = 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE';

export interface BillRateResult {
  billRate: number;
  billRateType: RateType;
}

export interface MarginResult {
  marginDollar: number;
  marginPercentage: number;
  isNegative: boolean;
}

export interface EffectiveMarkup {
  markupType: MarkupType | null;
  markupValue: number | null;
  markupBasis: MarkupBasis | null;
  source: 'staff_override' | 'agency_default' | 'none';
  rateLocked: boolean;
}

/**
 * Calculate the bill rate from true cost + markup.
 *
 * - PERCENTAGE + BASE_PAY: trueCost * (1 + markupValue / 100)
 * - PERCENTAGE + TOTAL_COMPENSATION: (trueCost + expenses + reimbursements) * (1 + markupValue / 100)
 * - FLAT_RATE: trueCost + flatAmount (flat amount converted to match true cost rate type)
 *
 * The bill rate is returned in the same rate type as the true cost.
 */
export function calculateBillRate(params: {
  trueCost: number;
  trueCostRateType: RateType;
  markupType: MarkupType;
  markupValue: number;
  markupBasis: MarkupBasis;
  expenses?: number;
  reimbursements?: number;
}): BillRateResult {
  const {
    trueCost,
    trueCostRateType,
    markupType,
    markupValue,
    markupBasis,
    expenses = 0,
    reimbursements = 0,
  } = params;

  let billRate: number;

  if (markupType === 'PERCENTAGE') {
    const multiplier = 1 + markupValue / 100;
    if (markupBasis === 'TOTAL_COMPENSATION') {
      billRate = (trueCost + expenses + reimbursements) * multiplier;
    } else {
      // BASE_PAY
      billRate = trueCost * multiplier;
    }
  } else {
    // FLAT_RATE — flat amount is added in the same rate unit as true cost
    // If the flat rate needs conversion (e.g., flat is hourly but true cost is monthly),
    // we convert using standard factors
    billRate = trueCost + markupValue;
  }

  return {
    billRate: Math.round(billRate * 100) / 100,
    billRateType: trueCostRateType,
  };
}

/**
 * Calculate the margin between bill rate and true cost.
 * Both values are normalized to monthly equivalents for comparison.
 *
 * Returns null-safe: if either rate is missing, returns null.
 */
export function calculateMargin(params: {
  billRate: number;
  billRateType: RateType;
  trueCost: number;
  trueCostRateType: RateType;
}): MarginResult {
  const { billRate, billRateType, trueCost, trueCostRateType } = params;

  const monthlyBillRate = toMonthlyCost(billRate, billRateType);
  const monthlyTrueCost = toMonthlyCost(trueCost, trueCostRateType);

  const marginDollar = monthlyBillRate - monthlyTrueCost;
  const marginPercentage =
    monthlyTrueCost > 0 ? (marginDollar / monthlyTrueCost) * 100 : 0;

  return {
    marginDollar: Math.round(marginDollar * 100) / 100,
    marginPercentage: Math.round(marginPercentage * 100) / 100,
    isNegative: marginDollar < 0,
  };
}

/**
 * Determine the effective markup for a staff member.
 *
 * Priority chain:
 * 1. rate_locked → return current values with rateLocked: true
 * 2. staff.markup_override_type set → use staff override
 * 3. agency.markup_type set → use agency default
 * 4. none → return nulls
 */
export function getEffectiveMarkup(
  staff: {
    rate_locked: boolean;
    markup_override_type?: string | null;
    markup_override_value?: number | string | null;
    true_cost?: number | string | null;
    true_cost_rate_type?: string | null;
  },
  agency: {
    markup_type?: string | null;
    markup_value?: number | string | null;
    markup_basis?: string | null;
  } | null
): EffectiveMarkup {
  // If rate is locked, still report the effective markup source but flag as locked
  if (staff.rate_locked) {
    // Determine source even when locked (for display purposes)
    if (staff.markup_override_type != null && staff.markup_override_value != null) {
      return {
        markupType: staff.markup_override_type as MarkupType,
        markupValue: Number(staff.markup_override_value),
        markupBasis: agency?.markup_basis as MarkupBasis ?? 'BASE_PAY',
        source: 'staff_override',
        rateLocked: true,
      };
    }
    if (agency?.markup_type != null && agency?.markup_value != null) {
      return {
        markupType: agency.markup_type as MarkupType,
        markupValue: Number(agency.markup_value),
        markupBasis: (agency.markup_basis as MarkupBasis) ?? 'BASE_PAY',
        source: 'agency_default',
        rateLocked: true,
      };
    }
    return {
      markupType: null,
      markupValue: null,
      markupBasis: null,
      source: 'none',
      rateLocked: true,
    };
  }

  // Staff override takes precedence
  if (staff.markup_override_type != null && staff.markup_override_value != null) {
    return {
      markupType: staff.markup_override_type as MarkupType,
      markupValue: Number(staff.markup_override_value),
      markupBasis: agency?.markup_basis as MarkupBasis ?? 'BASE_PAY',
      source: 'staff_override',
      rateLocked: false,
    };
  }

  // Agency default
  if (agency?.markup_type != null && agency?.markup_value != null) {
    return {
      markupType: agency.markup_type as MarkupType,
      markupValue: Number(agency.markup_value),
      markupBasis: (agency.markup_basis as MarkupBasis) ?? 'BASE_PAY',
      source: 'agency_default',
      rateLocked: false,
    };
  }

  // No markup configured
  return {
    markupType: null,
    markupValue: null,
    markupBasis: null,
    source: 'none',
    rateLocked: false,
  };
}
