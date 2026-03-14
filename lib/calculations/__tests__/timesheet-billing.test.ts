import { describe, it, expect, vi } from 'vitest';

// Mock prisma (server-only) before importing the module under test
vi.mock('@/lib/prisma', () => ({
  default: {},
  prisma: {},
}));

import {
  calculateOvertimeBreakdown,
  distributeOvertimeProportionally,
  getHourlyRate,
  calculateTimesheetBilling,
  type OvertimeConfigData,
  type AssignmentHours,
} from '../timesheet-billing';

// ---------------------------------------------------------------------------
// Shared configs
// ---------------------------------------------------------------------------

const defaultConfig: OvertimeConfigData = {
  threshold: 40,
  multiplier: 1.5,
  enabled: true,
};

const disabledConfig: OvertimeConfigData = {
  threshold: 40,
  multiplier: 1.5,
  enabled: false,
};

// ---------------------------------------------------------------------------
// calculateOvertimeBreakdown
// ---------------------------------------------------------------------------

describe('calculateOvertimeBreakdown', () => {
  it('returns all regular hours when under threshold', () => {
    const result = calculateOvertimeBreakdown(35, defaultConfig);
    expect(result.regularHours).toBe(35);
    expect(result.overtimeHours).toBe(0);
    expect(result.isOvertime).toBe(false);
  });

  it('returns all regular hours when exactly at threshold', () => {
    const result = calculateOvertimeBreakdown(40, defaultConfig);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(0);
    expect(result.isOvertime).toBe(false);
  });

  it('splits hours correctly when over threshold', () => {
    const result = calculateOvertimeBreakdown(48, defaultConfig);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(8);
    expect(result.isOvertime).toBe(true);
  });

  it('returns all regular hours when overtime is disabled', () => {
    const result = calculateOvertimeBreakdown(48, disabledConfig);
    expect(result.regularHours).toBe(48);
    expect(result.overtimeHours).toBe(0);
    expect(result.isOvertime).toBe(false);
  });

  it('handles zero hours', () => {
    const result = calculateOvertimeBreakdown(0, defaultConfig);
    expect(result.regularHours).toBe(0);
    expect(result.overtimeHours).toBe(0);
    expect(result.isOvertime).toBe(false);
  });

  it('handles fractional hours at boundary', () => {
    const result = calculateOvertimeBreakdown(40.5, defaultConfig);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(0.5);
    expect(result.isOvertime).toBe(true);
  });

  it('works with custom threshold', () => {
    const config: OvertimeConfigData = {
      threshold: 35,
      multiplier: 2.0,
      enabled: true,
    };
    const result = calculateOvertimeBreakdown(40, config);
    expect(result.regularHours).toBe(35);
    expect(result.overtimeHours).toBe(5);
    expect(result.isOvertime).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// distributeOvertimeProportionally
// ---------------------------------------------------------------------------

describe('distributeOvertimeProportionally', () => {
  it('distributes overtime to single assignment', () => {
    const assignments: AssignmentHours[] = [
      { assignmentId: 'a1', clientName: 'Client A', totalHours: 48, billableHours: 48 },
    ];
    const result = distributeOvertimeProportionally(assignments, 8);
    expect(result).toHaveLength(1);
    expect(result[0].overtimeHours).toBe(8);
    expect(result[0].regularHours).toBe(40);
  });

  it('distributes overtime proportionally across two assignments', () => {
    const assignments: AssignmentHours[] = [
      { assignmentId: 'a1', clientName: 'Client A', totalHours: 30, billableHours: 30 },
      { assignmentId: 'a2', clientName: 'Client B', totalHours: 18, billableHours: 18 },
    ];
    // Total billable = 48, overtime = 8
    // a1 share: (30/48)*8 = 5.0
    // a2 share: (18/48)*8 = 3.0
    const result = distributeOvertimeProportionally(assignments, 8);
    expect(result).toHaveLength(2);
    expect(result[0].overtimeHours).toBe(5);
    expect(result[0].regularHours).toBe(25);
    expect(result[1].overtimeHours).toBe(3);
    expect(result[1].regularHours).toBe(15);
  });

  it('distributes overtime proportionally across three assignments', () => {
    const assignments: AssignmentHours[] = [
      { assignmentId: 'a1', clientName: 'Client A', totalHours: 20, billableHours: 20 },
      { assignmentId: 'a2', clientName: 'Client B', totalHours: 20, billableHours: 20 },
      { assignmentId: 'a3', clientName: 'Client C', totalHours: 10, billableHours: 10 },
    ];
    // Total billable = 50, overtime = 10
    // a1: (20/50)*10 = 4, a2: (20/50)*10 = 4, a3: (10/50)*10 = 2
    const result = distributeOvertimeProportionally(assignments, 10);
    expect(result[0].overtimeHours).toBe(4);
    expect(result[0].regularHours).toBe(16);
    expect(result[1].overtimeHours).toBe(4);
    expect(result[1].regularHours).toBe(16);
    expect(result[2].overtimeHours).toBe(2);
    expect(result[2].regularHours).toBe(8);
  });

  it('handles zero overtime hours', () => {
    const assignments: AssignmentHours[] = [
      { assignmentId: 'a1', clientName: 'Client A', totalHours: 20, billableHours: 20 },
    ];
    const result = distributeOvertimeProportionally(assignments, 0);
    expect(result[0].overtimeHours).toBe(0);
    expect(result[0].regularHours).toBe(20);
  });

  it('handles empty assignments array', () => {
    const result = distributeOvertimeProportionally([], 8);
    expect(result).toHaveLength(0);
  });

  it('distributes evenly when total billable is zero', () => {
    const assignments: AssignmentHours[] = [
      { assignmentId: 'a1', clientName: 'Client A', totalHours: 0, billableHours: 0 },
      { assignmentId: 'a2', clientName: 'Client B', totalHours: 0, billableHours: 0 },
    ];
    const result = distributeOvertimeProportionally(assignments, 4);
    expect(result[0].overtimeHours).toBe(2);
    expect(result[1].overtimeHours).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getHourlyRate
// ---------------------------------------------------------------------------

describe('getHourlyRate', () => {
  it('returns hourly rate as-is', () => {
    expect(getHourlyRate(50, 'HOURLY')).toBe(50);
  });

  it('converts daily rate to hourly (rate / 8)', () => {
    expect(getHourlyRate(400, 'DAILY')).toBe(50);
  });

  it('converts monthly rate to hourly (rate / 176)', () => {
    // 8800 / (22 * 8) = 8800 / 176 = 50
    expect(getHourlyRate(8800, 'MONTHLY')).toBe(50);
  });

  it('treats VARIABLE as hourly', () => {
    expect(getHourlyRate(75, 'VARIABLE')).toBe(75);
  });

  it('defaults unknown rate types to hourly', () => {
    expect(getHourlyRate(60, 'UNKNOWN')).toBe(60);
  });

  it('handles fractional monthly conversion', () => {
    // 10000 / 176 = 56.818181...
    const result = getHourlyRate(10000, 'MONTHLY');
    expect(result).toBeCloseTo(56.82, 1);
  });
});

// ---------------------------------------------------------------------------
// calculateTimesheetBilling
// ---------------------------------------------------------------------------

describe('calculateTimesheetBilling', () => {
  it('calculates billing for single assignment under threshold (no overtime)', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(40);
    expect(result.totalNonBillableHours).toBe(0);
    expect(result.totalOvertimeHours).toBe(0);
    expect(result.regularAmount).toBe(2000); // 40 * 50
    expect(result.overtimeAmount).toBe(0);
    expect(result.totalAmount).toBe(2000);
    expect(result.byAssignment).toHaveLength(1);
    expect(result.byAssignment[0].regularHours).toBe(40);
    expect(result.byAssignment[0].overtimeHours).toBe(0);
  });

  it('calculates billing with overtime for single assignment', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 48, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(48);
    expect(result.totalOvertimeHours).toBe(8);
    // Regular: 40 * 50 = 2000
    // Overtime: 8 * 50 * 1.5 = 600
    expect(result.regularAmount).toBe(2000);
    expect(result.overtimeAmount).toBe(600);
    expect(result.totalAmount).toBe(2600);
  });

  it('distributes overtime proportionally across multiple assignments', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 30, isBillable: true },
        { assignmentId: 'a2', clientName: 'Client B', hours: 18, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(48);
    expect(result.totalOvertimeHours).toBe(8);

    // a1: 30/48 share -> OT = (30/48)*8 = 5, regular = 25
    // a2: 18/48 share -> OT = (18/48)*8 = 3, regular = 15
    expect(result.byAssignment[0].assignmentId).toBe('a1');
    expect(result.byAssignment[0].regularHours).toBe(25);
    expect(result.byAssignment[0].overtimeHours).toBe(5);
    // a1 amounts: regular 25*50=1250, OT 5*50*1.5=375
    expect(result.byAssignment[0].regularAmount).toBe(1250);
    expect(result.byAssignment[0].overtimeAmount).toBe(375);
    expect(result.byAssignment[0].totalAmount).toBe(1625);

    expect(result.byAssignment[1].assignmentId).toBe('a2');
    expect(result.byAssignment[1].regularHours).toBe(15);
    expect(result.byAssignment[1].overtimeHours).toBe(3);
    // a2 amounts: regular 15*50=750, OT 3*50*1.5=225
    expect(result.byAssignment[1].regularAmount).toBe(750);
    expect(result.byAssignment[1].overtimeAmount).toBe(225);
    expect(result.byAssignment[1].totalAmount).toBe(975);

    expect(result.totalAmount).toBe(2600);
  });

  it('separates non-billable hours correctly', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 30, isBillable: true },
        { assignmentId: null, clientName: '', hours: 5, isBillable: false },
        { assignmentId: 'a1', clientName: 'Client A', hours: 3, isBillable: false },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(30);
    expect(result.totalNonBillableHours).toBe(8);
    expect(result.totalOvertimeHours).toBe(0); // 30 < 40 threshold
    expect(result.regularAmount).toBe(1500); // 30 * 50
    expect(result.totalAmount).toBe(1500);
  });

  it('treats null assignment_id entries as non-billable', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: null, clientName: '', hours: 10, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(0);
    expect(result.totalNonBillableHours).toBe(10);
    expect(result.totalAmount).toBe(0);
    expect(result.byAssignment).toHaveLength(0);
  });

  it('handles zero hours', () => {
    const result = calculateTimesheetBilling({
      entries: [],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(0);
    expect(result.totalNonBillableHours).toBe(0);
    expect(result.totalOvertimeHours).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.byAssignment).toHaveLength(0);
  });

  it('calculates with overtime disabled', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 48, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: disabledConfig,
    });

    expect(result.totalBillableHours).toBe(48);
    expect(result.totalOvertimeHours).toBe(0);
    // All 48 hours at regular rate: 48 * 50 = 2400
    expect(result.regularAmount).toBe(2400);
    expect(result.overtimeAmount).toBe(0);
    expect(result.totalAmount).toBe(2400);
  });

  it('converts monthly rate to hourly for billing', () => {
    // 8800/month -> 50/hr (8800 / 176)
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 40, isBillable: true },
      ],
      staffRate: { rate: 8800, rateType: 'MONTHLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(40);
    // 40 * 50 = 2000
    expect(result.regularAmount).toBe(2000);
    expect(result.totalAmount).toBe(2000);
  });

  it('converts daily rate to hourly for billing', () => {
    // 400/day -> 50/hr (400 / 8)
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 40, isBillable: true },
      ],
      staffRate: { rate: 400, rateType: 'DAILY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.regularAmount).toBe(2000); // 40 * 50
  });

  it('handles decimal precision correctly', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 41.5, isBillable: true },
      ],
      staffRate: { rate: 33.33, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    // Regular: 40 * 33.33 = 1333.20
    // Overtime: 1.5 * 33.33 * 1.5 = 74.99
    expect(result.totalOvertimeHours).toBe(1.5);
    expect(result.regularAmount).toBe(1333.2);
    expect(result.overtimeAmount).toBe(74.99);
    expect(result.totalAmount).toBe(1408.19);
  });

  it('aggregates multiple entries for the same assignment', () => {
    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
        { assignmentId: 'a1', clientName: 'Client A', hours: 8, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: defaultConfig,
    });

    expect(result.totalBillableHours).toBe(24);
    expect(result.byAssignment).toHaveLength(1);
    expect(result.byAssignment[0].regularHours).toBe(24);
    expect(result.regularAmount).toBe(1200); // 24 * 50
  });

  it('uses custom overtime multiplier', () => {
    const config: OvertimeConfigData = {
      threshold: 40,
      multiplier: 2.0,
      enabled: true,
    };

    const result = calculateTimesheetBilling({
      entries: [
        { assignmentId: 'a1', clientName: 'Client A', hours: 45, isBillable: true },
      ],
      staffRate: { rate: 50, rateType: 'HOURLY' },
      overtimeConfig: config,
    });

    // Regular: 40 * 50 = 2000
    // Overtime: 5 * 50 * 2.0 = 500
    expect(result.regularAmount).toBe(2000);
    expect(result.overtimeAmount).toBe(500);
    expect(result.totalAmount).toBe(2500);
  });
});
