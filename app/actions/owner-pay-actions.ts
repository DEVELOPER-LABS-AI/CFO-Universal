'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  refreshOwnerPaySchema,
  refreshAllOwnerPaySchema,
  getOwnerPayHistorySchema,
  updateOwnerPayNotesSchema,
  setOwnerPayOverrideSchema,
} from '@/lib/validations/owner-pay';
import {
  getOwnerMercuryActual,
  getOwnerTransactions as getOwnerTransactionsCalc,
  computeExpectedAmount,
  computeCumulativeDeferred,
} from '@/lib/calculations/owner-pay';

/**
 * Fetch all staff members with engagement_type = 'OWNER'.
 */
export async function getOwners() {
  const organizationId = await getOrganizationId();

  const owners = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      engagement_type: 'OWNER',
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      rate: true,
      rate_type: true,
      engagement_type: true,
      compensation_start_date: true,
      pay_day: true,
    },
    orderBy: { name: 'asc' },
  });

  return owners;
}

/**
 * Get owner pay history records, optionally filtered by staff_id and year.
 */
export async function getOwnerPayHistory(input?: unknown) {
  const validated = input
    ? getOwnerPayHistorySchema.parse(input)
    : getOwnerPayHistorySchema.parse({});
  const organizationId = await getOrganizationId();

  const where: Record<string, unknown> = {
    organization_id: organizationId,
  };
  if (validated.staff_id) where.staff_id = validated.staff_id;
  if (validated.year) where.year = validated.year;

  const records = await prisma.ownerMonthlyPay.findMany({
    where,
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          rate: true,
          rate_type: true,
          pay_day: true,
        },
      },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return records;
}

/**
 * Refresh (upsert) an OwnerMonthlyPay record for a single owner + month.
 * Computes expected from staff rate (gated by compensation_start_date),
 * actual from Mercury, shortfall, and cumulative.
 */
export async function refreshOwnerPay(input: unknown) {
  const validated = refreshOwnerPaySchema.parse(input);
  const organizationId = await getOrganizationId();

  // Verify staff exists and is an owner
  const staff = await prisma.staff.findFirst({
    where: {
      id: validated.staff_id,
      organization_id: organizationId,
      engagement_type: 'OWNER',
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      rate: true,
      rate_type: true,
      compensation_start_date: true,
    },
  });

  if (!staff) throw new Error('Owner not found');

  const expected = computeExpectedAmount(
    Number(staff.rate),
    staff.rate_type,
    validated.month,
    validated.year,
    staff.compensation_start_date
  );
  const actual = await getOwnerMercuryActual(
    staff.id,
    validated.month,
    validated.year,
    organizationId
  );
  const shortfall = expected - actual;

  // Upsert the record (without cumulative first)
  await prisma.ownerMonthlyPay.upsert({
    where: {
      staff_id_month_year: {
        staff_id: staff.id,
        month: validated.month,
        year: validated.year,
      },
    },
    create: {
      staff_id: staff.id,
      organization_id: organizationId,
      month: validated.month,
      year: validated.year,
      expected_amount: expected,
      actual_amount: actual,
      shortfall,
      cumulative_deferred: 0, // placeholder, recomputed below
    },
    update: {
      expected_amount: expected,
      actual_amount: actual,
      shortfall,
    },
  });

  // Recompute cumulative deferred (includes this month's shortfall)
  const cumulative = await computeCumulativeDeferred(
    staff.id,
    validated.month,
    validated.year
  );

  await prisma.ownerMonthlyPay.update({
    where: {
      staff_id_month_year: {
        staff_id: staff.id,
        month: validated.month,
        year: validated.year,
      },
    },
    data: { cumulative_deferred: cumulative },
  });

  revalidatePath('/dashboard/compensation');
  return { staff_id: staff.id, month: validated.month, year: validated.year, expected, actual, shortfall, cumulative };
}

/**
 * Refresh all owners for ALL months from their compensation_start_date
 * through the given month/year. This ensures back-pay, merchant mapping
 * changes, and cumulative deferred are always recomputed correctly.
 *
 * Three passes per owner:
 *   Pass 1: Compute raw expected + actual for each month, upsert records
 *   Pass 2: Carry-forward rebalancing — excess actual in one month
 *           automatically covers shortfalls in subsequent months
 *   Pass 3: Compute cumulative deferred from rebalanced shortfalls
 */
export async function refreshAllOwnerPay(input: unknown) {
  const validated = refreshAllOwnerPaySchema.parse(input);
  const organizationId = await getOrganizationId();

  const owners = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      engagement_type: 'OWNER',
      deleted_at: null,
    },
    select: {
      id: true,
      rate: true,
      rate_type: true,
      compensation_start_date: true,
    },
  });

  const results = [];

  for (const owner of owners) {
    let startMonth: number;
    let startYear: number;
    if (owner.compensation_start_date) {
      startYear = owner.compensation_start_date.getFullYear();
      startMonth = owner.compensation_start_date.getMonth() + 1;
    } else {
      startYear = validated.year;
      startMonth = validated.month;
    }

    // Load existing overrides for this owner so we can respect them
    const existingRecords = await prisma.ownerMonthlyPay.findMany({
      where: { staff_id: owner.id, override_paid: true },
      select: { month: true, year: true, override_amount: true },
    });
    const overrideMap = new Map<string, number>();
    for (const rec of existingRecords) {
      if (rec.override_amount !== null) {
        overrideMap.set(`${rec.year}-${rec.month}`, Number(rec.override_amount));
      }
    }

    // Pass 1: Compute raw expected + actual for each month, upsert records
    // If override_paid is set, use override_amount as the actual instead of Mercury
    const months: Array<{ month: number; year: number; expected: number; actual: number; shortfall: number }> = [];
    let m = startMonth;
    let y = startYear;
    while (y < validated.year || (y === validated.year && m <= validated.month)) {
      const expected = computeExpectedAmount(
        Number(owner.rate),
        owner.rate_type,
        m,
        y,
        owner.compensation_start_date
      );

      const overrideKey = `${y}-${m}`;
      const mercuryActual = await getOwnerMercuryActual(owner.id, m, y, organizationId);
      const actual = overrideMap.has(overrideKey) ? overrideMap.get(overrideKey)! : mercuryActual;
      const shortfall = expected - actual;

      await prisma.ownerMonthlyPay.upsert({
        where: {
          staff_id_month_year: {
            staff_id: owner.id,
            month: m,
            year: y,
          },
        },
        create: {
          staff_id: owner.id,
          organization_id: organizationId,
          month: m,
          year: y,
          expected_amount: expected,
          actual_amount: mercuryActual,
          shortfall,
          cumulative_deferred: 0,
        },
        update: {
          expected_amount: expected,
          actual_amount: mercuryActual,
          shortfall,
        },
      });

      months.push({ month: m, year: y, expected, actual, shortfall });
      m++;
      if (m > 12) { m = 1; y++; }
    }

    // Pass 2: Carry-forward rebalancing (resets each year)
    // If a month has excess actual (actual > expected), the surplus carries
    // forward to cover shortfalls in subsequent months within the same year.
    let carryForward = 0;
    let carryYear = -1;
    for (const mo of months) {
      if (mo.year !== carryYear) {
        carryForward = 0;
        carryYear = mo.year;
      }
      const effectiveActual = mo.actual + carryForward;
      if (effectiveActual >= mo.expected) {
        carryForward = effectiveActual - mo.expected;
        mo.shortfall = 0;
      } else {
        mo.shortfall = mo.expected - effectiveActual;
        carryForward = 0;
      }
    }

    // Pass 3: Compute cumulative deferred from rebalanced shortfalls and persist
    // Resets each year so cumulative shows what's owed for that year only
    let cumulative = 0;
    let cumulativeYear = -1;
    for (const mo of months) {
      if (mo.year !== cumulativeYear) {
        cumulative = 0;
        cumulativeYear = mo.year;
      }
      cumulative += mo.shortfall;

      await prisma.ownerMonthlyPay.update({
        where: {
          staff_id_month_year: {
            staff_id: owner.id,
            month: mo.month,
            year: mo.year,
          },
        },
        data: {
          shortfall: mo.shortfall,
          cumulative_deferred: cumulative,
        },
      });

      results.push({
        staff_id: owner.id,
        month: mo.month,
        year: mo.year,
        expected: mo.expected,
        actual: mo.actual,
        shortfall: mo.shortfall,
        cumulative,
      });
    }
  }

  revalidatePath('/dashboard/compensation');
  return results;
}

/**
 * Get individual transactions for an owner in a given month.
 */
export async function getOwnerTransactionsAction(staffId: string, month: number, year: number) {
  const organizationId = await getOrganizationId();
  return getOwnerTransactionsCalc(staffId, month, year, organizationId);
}

/**
 * Update owner compensation settings (rate, start date, pay day).
 */
export async function updateOwnerCompSettings(input: {
  staffId: string;
  rate?: number;
  rateType?: string;
  compensationStartDate?: string | null;
  payDay?: number | null;
}) {
  const organizationId = await getOrganizationId();

  const staff = await prisma.staff.findFirst({
    where: {
      id: input.staffId,
      organization_id: organizationId,
      engagement_type: 'OWNER',
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!staff) throw new Error('Owner not found');

  const data: Record<string, unknown> = {};
  if (input.rate !== undefined) data.rate = input.rate;
  if (input.rateType !== undefined) data.rate_type = input.rateType;
  if (input.compensationStartDate !== undefined) {
    data.compensation_start_date = input.compensationStartDate
      ? new Date(input.compensationStartDate)
      : null;
  }
  if (input.payDay !== undefined) data.pay_day = input.payDay;

  await prisma.staff.update({
    where: { id: staff.id },
    data,
  });

  revalidatePath('/dashboard/compensation');
  revalidatePath('/dashboard/staff');
}

/**
 * Update notes on an OwnerMonthlyPay record.
 */
export async function updateOwnerPayNotes(input: unknown) {
  const validated = updateOwnerPayNotesSchema.parse(input);
  await getOrganizationId(); // auth check

  const record = await prisma.ownerMonthlyPay.update({
    where: { id: validated.id },
    data: { notes: validated.notes },
  });

  revalidatePath('/dashboard/compensation');
  return record;
}

/**
 * Set or clear a manual override for an OwnerMonthlyPay record.
 * When override_paid is true, the override_amount is used as the effective
 * actual for carry-forward and cumulative calculations during refresh.
 */
export async function setOwnerPayOverride(input: unknown) {
  const validated = setOwnerPayOverrideSchema.parse(input);
  const organizationId = await getOrganizationId();

  // Verify the record belongs to this organization
  const record = await prisma.ownerMonthlyPay.findFirst({
    where: { id: validated.id, organization_id: organizationId },
    select: { id: true, staff_id: true, month: true, year: true },
  });

  if (!record) throw new Error('Record not found');

  await prisma.ownerMonthlyPay.update({
    where: { id: record.id },
    data: {
      override_paid: validated.override_paid,
      override_amount: validated.override_paid ? validated.override_amount : null,
      override_note: validated.override_paid ? (validated.override_note ?? null) : null,
    },
  });

  revalidatePath('/dashboard/compensation');
  return { id: record.id, override_paid: validated.override_paid, override_amount: validated.override_amount };
}

/**
 * Dashboard summary: total deferred compensation across all owners, current month shortfall.
 */
export async function getOwnerPayDashboardSummary() {
  const organizationId = await getOrganizationId();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Get current month records for all owners
  const currentRecords = await prisma.ownerMonthlyPay.findMany({
    where: {
      organization_id: organizationId,
      month: currentMonth,
      year: currentYear,
    },
    select: {
      expected_amount: true,
      actual_amount: true,
      shortfall: true,
      cumulative_deferred: true,
    },
  });

  const totalExpected = currentRecords.reduce((sum, r) => sum + Number(r.expected_amount), 0);
  const totalActual = currentRecords.reduce((sum, r) => sum + Number(r.actual_amount), 0);
  const totalShortfall = currentRecords.reduce((sum, r) => sum + Number(r.shortfall), 0);
  const totalDeferred = currentRecords.reduce((sum, r) => sum + Number(r.cumulative_deferred), 0);

  return {
    currentMonth,
    currentYear,
    totalExpected,
    totalActual,
    totalShortfall,
    totalDeferred,
    ownerCount: currentRecords.length,
  };
}
