import { describe, it, expect } from 'vitest';
import {
  calculateBillRate,
  calculateMargin,
  getEffectiveMarkup,
} from '../markup-calculations';

describe('calculateBillRate', () => {
  it('calculates percentage markup on base pay', () => {
    const result = calculateBillRate({
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
      markupType: 'PERCENTAGE',
      markupValue: 30,
      markupBasis: 'BASE_PAY',
    });
    expect(result.billRate).toBe(6500);
    expect(result.billRateType).toBe('MONTHLY');
  });

  it('calculates percentage markup on total compensation', () => {
    const result = calculateBillRate({
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
      markupType: 'PERCENTAGE',
      markupValue: 30,
      markupBasis: 'TOTAL_COMPENSATION',
      expenses: 200,
      reimbursements: 100,
    });
    // (5000 + 200 + 100) * 1.30 = 6890
    expect(result.billRate).toBe(6890);
    expect(result.billRateType).toBe('MONTHLY');
  });

  it('calculates flat rate markup', () => {
    const result = calculateBillRate({
      trueCost: 30,
      trueCostRateType: 'HOURLY',
      markupType: 'FLAT_RATE',
      markupValue: 15,
      markupBasis: 'BASE_PAY',
    });
    // 30 + 15 = 45
    expect(result.billRate).toBe(45);
    expect(result.billRateType).toBe('HOURLY');
  });

  it('handles zero markup (cost pass-through)', () => {
    const result = calculateBillRate({
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
      markupType: 'PERCENTAGE',
      markupValue: 0,
      markupBasis: 'BASE_PAY',
    });
    expect(result.billRate).toBe(5000);
  });

  it('handles zero flat rate markup', () => {
    const result = calculateBillRate({
      trueCost: 50,
      trueCostRateType: 'HOURLY',
      markupType: 'FLAT_RATE',
      markupValue: 0,
      markupBasis: 'BASE_PAY',
    });
    expect(result.billRate).toBe(50);
  });

  it('rounds bill rate to 2 decimal places', () => {
    const result = calculateBillRate({
      trueCost: 33.33,
      trueCostRateType: 'HOURLY',
      markupType: 'PERCENTAGE',
      markupValue: 33,
      markupBasis: 'BASE_PAY',
    });
    // 33.33 * 1.33 = 44.3289
    expect(result.billRate).toBe(44.33);
  });

  it('uses default 0 for expenses and reimbursements when not provided', () => {
    const result = calculateBillRate({
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
      markupType: 'PERCENTAGE',
      markupValue: 20,
      markupBasis: 'TOTAL_COMPENSATION',
    });
    // (5000 + 0 + 0) * 1.20 = 6000
    expect(result.billRate).toBe(6000);
  });

  it('handles daily rate type', () => {
    const result = calculateBillRate({
      trueCost: 300,
      trueCostRateType: 'DAILY',
      markupType: 'PERCENTAGE',
      markupValue: 25,
      markupBasis: 'BASE_PAY',
    });
    // 300 * 1.25 = 375
    expect(result.billRate).toBe(375);
    expect(result.billRateType).toBe('DAILY');
  });
});

describe('calculateMargin', () => {
  it('calculates positive margin with same rate types', () => {
    const result = calculateMargin({
      billRate: 6500,
      billRateType: 'MONTHLY',
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
    });
    expect(result.marginDollar).toBe(1500);
    expect(result.marginPercentage).toBe(30);
    expect(result.isNegative).toBe(false);
  });

  it('detects negative margin', () => {
    const result = calculateMargin({
      billRate: 4000,
      billRateType: 'MONTHLY',
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
    });
    expect(result.marginDollar).toBe(-1000);
    expect(result.marginPercentage).toBe(-20);
    expect(result.isNegative).toBe(true);
  });

  it('handles rate type conversion (hourly true cost, monthly bill rate)', () => {
    // Hourly true cost: $30/hr -> monthly: 30 * 176 = $5,280
    // Monthly bill rate: $6,864
    const result = calculateMargin({
      billRate: 6864,
      billRateType: 'MONTHLY',
      trueCost: 30,
      trueCostRateType: 'HOURLY',
    });
    // margin = 6864 - 5280 = 1584
    expect(result.marginDollar).toBe(1584);
    expect(result.marginPercentage).toBe(30);
    expect(result.isNegative).toBe(false);
  });

  it('handles daily to monthly conversion', () => {
    // Daily true cost: $250/day -> monthly: 250 * 22 = $5,500
    // Monthly bill rate: $7,150
    const result = calculateMargin({
      billRate: 7150,
      billRateType: 'MONTHLY',
      trueCost: 250,
      trueCostRateType: 'DAILY',
    });
    // margin = 7150 - 5500 = 1650
    expect(result.marginDollar).toBe(1650);
    expect(result.marginPercentage).toBe(30);
    expect(result.isNegative).toBe(false);
  });

  it('handles zero margin', () => {
    const result = calculateMargin({
      billRate: 5000,
      billRateType: 'MONTHLY',
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
    });
    expect(result.marginDollar).toBe(0);
    expect(result.marginPercentage).toBe(0);
    expect(result.isNegative).toBe(false);
  });

  it('handles zero true cost gracefully', () => {
    const result = calculateMargin({
      billRate: 5000,
      billRateType: 'MONTHLY',
      trueCost: 0,
      trueCostRateType: 'MONTHLY',
    });
    // margin% = 0 when true cost is 0 (division guard)
    expect(result.marginDollar).toBe(5000);
    expect(result.marginPercentage).toBe(0);
    expect(result.isNegative).toBe(false);
  });

  it('rounds margin values to 2 decimal places', () => {
    const result = calculateMargin({
      billRate: 6666.67,
      billRateType: 'MONTHLY',
      trueCost: 5000,
      trueCostRateType: 'MONTHLY',
    });
    expect(result.marginDollar).toBe(1666.67);
    expect(result.marginPercentage).toBe(33.33);
  });
});

describe('getEffectiveMarkup', () => {
  it('returns staff override when present', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: false,
        markup_override_type: 'PERCENTAGE',
        markup_override_value: 25,
      },
      {
        markup_type: 'PERCENTAGE',
        markup_value: 30,
        markup_basis: 'BASE_PAY',
      }
    );
    expect(result.source).toBe('staff_override');
    expect(result.markupType).toBe('PERCENTAGE');
    expect(result.markupValue).toBe(25);
    expect(result.rateLocked).toBe(false);
  });

  it('falls back to agency default when no staff override', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: false,
        markup_override_type: null,
        markup_override_value: null,
      },
      {
        markup_type: 'FLAT_RATE',
        markup_value: 15,
        markup_basis: 'TOTAL_COMPENSATION',
      }
    );
    expect(result.source).toBe('agency_default');
    expect(result.markupType).toBe('FLAT_RATE');
    expect(result.markupValue).toBe(15);
    expect(result.markupBasis).toBe('TOTAL_COMPENSATION');
  });

  it('returns none when no markup configured', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: false,
        markup_override_type: null,
        markup_override_value: null,
      },
      {
        markup_type: null,
        markup_value: null,
        markup_basis: null,
      }
    );
    expect(result.source).toBe('none');
    expect(result.markupType).toBeNull();
    expect(result.markupValue).toBeNull();
  });

  it('returns none when agency is null', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: false,
        markup_override_type: null,
        markup_override_value: null,
      },
      null
    );
    expect(result.source).toBe('none');
  });

  it('reports rateLocked=true with staff override source when locked', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: true,
        markup_override_type: 'PERCENTAGE',
        markup_override_value: 25,
      },
      {
        markup_type: 'PERCENTAGE',
        markup_value: 30,
        markup_basis: 'BASE_PAY',
      }
    );
    expect(result.rateLocked).toBe(true);
    expect(result.source).toBe('staff_override');
    expect(result.markupValue).toBe(25);
  });

  it('reports rateLocked=true with agency source when locked without override', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: true,
        markup_override_type: null,
        markup_override_value: null,
      },
      {
        markup_type: 'PERCENTAGE',
        markup_value: 30,
        markup_basis: 'BASE_PAY',
      }
    );
    expect(result.rateLocked).toBe(true);
    expect(result.source).toBe('agency_default');
    expect(result.markupValue).toBe(30);
  });

  it('reports rateLocked=true with none source when no markup configured', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: true,
        markup_override_type: null,
        markup_override_value: null,
      },
      { markup_type: null, markup_value: null, markup_basis: null }
    );
    expect(result.rateLocked).toBe(true);
    expect(result.source).toBe('none');
  });

  it('handles Decimal string values from Prisma', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: false,
        markup_override_type: null,
        markup_override_value: null,
      },
      {
        markup_type: 'PERCENTAGE',
        markup_value: '30.00', // Prisma Decimal comes as string
        markup_basis: 'BASE_PAY',
      }
    );
    expect(result.markupValue).toBe(30);
    expect(result.source).toBe('agency_default');
  });

  it('defaults markup_basis to BASE_PAY when agency has no basis set', () => {
    const result = getEffectiveMarkup(
      {
        rate_locked: false,
        markup_override_type: null,
        markup_override_value: null,
      },
      {
        markup_type: 'PERCENTAGE',
        markup_value: 20,
        markup_basis: null,
      }
    );
    expect(result.markupBasis).toBe('BASE_PAY');
  });
});
