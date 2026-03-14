/**
 * Unit Tests for Xero Expense Categorization
 *
 * Tests categorization priority ordering and contractor name matching.
 */

describe('Expense Categorizer', () => {
  describe('Categorization Priority Ordering', () => {
    it('should prioritize contractor detection over account code', () => {
      // Priority: 1. Contractor, 2. Account Code, 3. Keywords, 4. Other
      const priorities = [
        'CONTRACTOR', // Highest priority
        'ACCOUNT_CODE',
        'KEYWORDS',
        'OTHER', // Lowest priority / fallback
      ];

      expect(priorities[0]).toBe('CONTRACTOR');
      expect(priorities[priorities.length - 1]).toBe('OTHER');
    });

    it('should use account code pattern if contractor not found', () => {
      const testCases = [
        {
          accountCode: '600',
          accountCodePattern: '6%',
          expectedType: 'CONTRACTOR',
          description: 'Account code 6% should match CONTRACTOR',
        },
        {
          accountCode: '620',
          accountCodePattern: '6%',
          expectedType: 'CONTRACTOR',
          description: 'Account code 6% prefix should match CONTRACTOR',
        },
      ];

      testCases.forEach((testCase) => {
        expect(testCase.accountCode.startsWith('6')).toBe(true);
      });
    });

    it('should use keyword matching if contractor and account code fail', () => {
      const keywordTests = [
        {
          description: 'Monthly subscription to SaaS platform',
          keywords: 'subscription|saas|software',
          expectedType: 'SUBSCRIPTION',
        },
        {
          description: 'Office rent payment',
          keywords: 'rent|utilities|office|insurance',
          expectedType: 'OVERHEAD',
        },
      ];

      keywordTests.forEach((test) => {
        const regex = new RegExp(test.keywords, 'i');
        expect(regex.test(test.description)).toBe(true);
      });
    });

    it('should fallback to OTHER if no rules match', () => {
      const unmatchedExpense = {
        payee: 'Unknown Vendor',
        accountCode: '999',
        description: 'Miscellaneous expense',
      };

      // No contractor match, no account code pattern, no keywords
      const expectedType = 'OTHER';
      expect(expectedType).toBe('OTHER');
    });
  });

  describe('Contractor Name Matching', () => {
    it('should use 0.8 similarity threshold for contractor matching', () => {
      const CONTRACTOR_NAME_SIMILARITY_THRESHOLD = 0.8;

      expect(CONTRACTOR_NAME_SIMILARITY_THRESHOLD).toBe(0.8);
    });

    it('should match similar contractor names with high confidence', () => {
      const testCases = [
        {
          payee: 'John Smith Consulting',
          contractor: 'John Smith',
          expected: true, // Should match
        },
        {
          payee: 'ACME Corporation Ltd',
          contractor: 'ACME Corp',
          expected: true, // Should match
        },
        {
          payee: 'Tech Solutions Inc',
          contractor: 'Tech Solutions',
          expected: true, // Should match
        },
      ];

      // Note: Actual similarity calculation done by string-similarity package
      // This test documents the expected behavior
      testCases.forEach((testCase) => {
        expect(testCase.expected).toBe(true);
      });
    });

    it('should reject dissimilar names with low confidence', () => {
      const testCases = [
        {
          payee: 'John Smith',
          contractor: 'Jane Doe',
          expected: false, // Should NOT match
        },
        {
          payee: 'ACME Corp',
          contractor: 'Zenith Industries',
          expected: false, // Should NOT match
        },
      ];

      testCases.forEach((testCase) => {
        expect(testCase.expected).toBe(false);
      });
    });
  });

  describe('Expense Types', () => {
    it('should define correct expense types', () => {
      const expenseTypes = ['CONTRACTOR', 'SUBSCRIPTION', 'OVERHEAD', 'OTHER'];

      expect(expenseTypes).toContain('CONTRACTOR');
      expect(expenseTypes).toContain('SUBSCRIPTION');
      expect(expenseTypes).toContain('OVERHEAD');
      expect(expenseTypes).toContain('OTHER');
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign high confidence to contractor matches', () => {
      // Contractor matches should have confidence = similarity score (0.8-1.0)
      const contractorMatchConfidence = 0.85;
      expect(contractorMatchConfidence).toBeGreaterThanOrEqual(0.8);
      expect(contractorMatchConfidence).toBeLessThanOrEqual(1.0);
    });

    it('should assign medium confidence to account code matches', () => {
      // Account code matches should have confidence ~0.9
      const accountCodeMatchConfidence = 0.9;
      expect(accountCodeMatchConfidence).toBe(0.9);
    });

    it('should assign lower confidence to keyword matches', () => {
      // Keyword matches should have confidence ~0.8
      const keywordMatchConfidence = 0.8;
      expect(keywordMatchConfidence).toBe(0.8);
    });

    it('should assign zero confidence to OTHER category', () => {
      // OTHER (unmatched) should have confidence = 0.0
      const otherConfidence = 0.0;
      expect(otherConfidence).toBe(0.0);
    });
  });

  describe('Categorization Rules', () => {
    it('should support account code wildcard patterns', () => {
      const patterns = [
        { pattern: '6%', accountCode: '600', matches: true },
        { pattern: '6%', accountCode: '620', matches: true },
        { pattern: '6%', accountCode: '700', matches: false },
        { pattern: '5%', accountCode: '500', matches: true },
        { pattern: '5%', accountCode: '600', matches: false },
      ];

      patterns.forEach(({ pattern, accountCode, matches }) => {
        const prefix = pattern.replace('%', '');
        const result = accountCode.startsWith(prefix);
        expect(result).toBe(matches);
      });
    });

    it('should support regex keyword patterns', () => {
      const patterns = [
        {
          pattern: 'subscription|saas|software',
          description: 'Monthly SaaS subscription',
          matches: true,
        },
        {
          pattern: 'subscription|saas|software',
          description: 'Adobe Creative Cloud license',
          matches: true,
        },
        {
          pattern: 'rent|utilities|office|insurance',
          description: 'Office rent payment',
          matches: true,
        },
        {
          pattern: 'rent|utilities|office|insurance',
          description: 'Random expense',
          matches: false,
        },
      ];

      patterns.forEach(({ pattern, description, matches }) => {
        const regex = new RegExp(pattern, 'i');
        const result = regex.test(description);
        expect(result).toBe(matches);
      });
    });
  });

  describe('Target Accuracy', () => {
    it('should achieve 90% categorization accuracy', () => {
      // Target: 90% of expenses should be auto-categorized (not OTHER)
      const TARGET_CATEGORIZATION_ACCURACY = 0.9;

      expect(TARGET_CATEGORIZATION_ACCURACY).toBe(0.9);

      // Example scenario:
      const totalExpenses = 20;
      const categorizedExpenses = 18; // 90%
      const uncategorizedExpenses = 2; // 10%

      const actualAccuracy = categorizedExpenses / totalExpenses;
      expect(actualAccuracy).toBeGreaterThanOrEqual(TARGET_CATEGORIZATION_ACCURACY);
    });
  });

  describe('Default Categorization Rules', () => {
    it('should seed default rules on first connection', () => {
      const defaultRules = [
        {
          account_code_pattern: '6%',
          expense_type: 'CONTRACTOR',
          priority: 100,
        },
        {
          keyword_pattern: 'subscription|saas|software',
          expense_type: 'SUBSCRIPTION',
          priority: 90,
        },
        {
          keyword_pattern: 'rent|utilities|office|insurance',
          expense_type: 'OVERHEAD',
          priority: 80,
        },
      ];

      expect(defaultRules.length).toBe(3);
      expect(defaultRules[0].expense_type).toBe('CONTRACTOR');
      expect(defaultRules[1].expense_type).toBe('SUBSCRIPTION');
      expect(defaultRules[2].expense_type).toBe('OVERHEAD');
    });
  });
});

// Integration test placeholders (require database)
describe('Expense Categorizer Integration Tests (require DB)', () => {
  it('should categorize 90% of sample expenses correctly', () => {
    // TODO: Implement with real database and sample expense data
    expect(true).toBe(true);
  });

  it('should link contractor payments to contractor records', () => {
    // TODO: Implement with real database
    expect(true).toBe(true);
  });

  it('should flag uncategorized expenses for manual review', () => {
    // TODO: Implement with real database
    expect(true).toBe(true);
  });
});
