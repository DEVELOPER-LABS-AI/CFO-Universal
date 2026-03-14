/**
 * Transaction Categorization Engine
 *
 * Implements priority-based categorization:
 * 1. Contractor match (highest priority, 95% confidence)
 * 2. Admin-defined rules (90% confidence)
 * 3. Default keyword patterns (70-80% confidence)
 * 4. OTHER (0% confidence, requires manual categorization)
 */

import { prisma } from '@/lib/prisma';
import type { CategorizationResult } from '@/types/mercury';
import type { ExpenseCategory } from '@prisma/client';

interface CategorizationRule {
  id: string;
  rule_type: 'MERCHANT_NAME' | 'DESCRIPTION_KEYWORD' | 'AMOUNT_RANGE';
  pattern: string;
  category: ExpenseCategory;
  priority: number;
}

/** Extended rule with entity FK fields for per-transaction mapping */
interface MerchantScopedRule extends CategorizationRule {
  contractor_id: string | null;
  subscription_id: string | null;
  agency_id: string | null;
  client_id: string | null;
  expense_category_id: string | null;
  staff_id: string | null;
}

/**
 * Get categorization rules for an organization
 * Sorted by priority (descending)
 *
 * @param organizationId - Organization ID
 * @returns Array of active categorization rules
 */
export async function getCategorizationRules(
  organizationId: string
): Promise<CategorizationRule[]> {
  const rules = await prisma.transactionCategorizationRule.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      merchant_name_scope: null, // Exclude merchant-scoped rules (handled by getMerchantScopedRules)
    },
    select: {
      id: true,
      rule_type: true,
      pattern: true,
      category: true,
      priority: true,
    },
    orderBy: {
      priority: 'desc', // Highest priority first
    },
  });

  return rules;
}

/**
 * Get categorization rules scoped to a specific merchant name
 * Used for PER_TRANSACTION mapping mode
 *
 * @param organizationId - Organization ID
 * @param merchantName - Merchant name to scope rules to
 * @returns Array of active merchant-scoped rules with entity FKs
 */
export async function getMerchantScopedRules(
  organizationId: string,
  merchantName: string
): Promise<MerchantScopedRule[]> {
  const rules = await prisma.transactionCategorizationRule.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      merchant_name_scope: merchantName,
    },
    select: {
      id: true,
      rule_type: true,
      pattern: true,
      category: true,
      priority: true,
      contractor_id: true,
      subscription_id: true,
      agency_id: true,
      client_id: true,
      expense_category_id: true,
      staff_id: true,
    },
    orderBy: {
      priority: 'desc',
    },
  });

  return rules;
}

/**
 * Check if transaction matches a categorization rule
 *
 * @param transaction - Transaction details
 * @param rule - Categorization rule to check
 * @returns true if transaction matches rule
 */
export function matchesRule(
  transaction: {
    merchantName: string;
    description: string | null;
    amount: number;
  },
  rule: CategorizationRule
): boolean {
  try {
    switch (rule.rule_type) {
      case 'MERCHANT_NAME': {
        // Case-insensitive regex match on merchant name
        const regex = new RegExp(rule.pattern, 'i');
        return regex.test(transaction.merchantName);
      }

      case 'DESCRIPTION_KEYWORD': {
        // Case-insensitive regex match on description
        if (!transaction.description) {
          return false;
        }
        const regex = new RegExp(rule.pattern, 'i');
        return regex.test(transaction.description);
      }

      case 'AMOUNT_RANGE': {
        // Pattern format: "min-max" (e.g., "1000-5000")
        const [minStr, maxStr] = rule.pattern.split('-');
        const min = parseFloat(minStr);
        const max = parseFloat(maxStr);

        if (isNaN(min) || isNaN(max)) {
          console.warn(`Invalid amount range pattern: ${rule.pattern}`);
          return false;
        }

        return transaction.amount >= min && transaction.amount <= max;
      }

      default:
        return false;
    }
  } catch (error) {
    console.error(`Error matching rule ${rule.id}:`, error);
    return false;
  }
}

/**
 * Default keyword patterns for common expense categories
 * Used as fallback when no custom rules match
 */
const DEFAULT_PATTERNS: Array<{
  pattern: RegExp;
  category: ExpenseCategory;
  confidence: number;
}> = [
  // Transfers (internal account transfers, Mercury Credit payments)
  {
    pattern: /mercury\s*(checking|savings|credit|treasury)|internal\s*transfer|transfer\s*(to|from)\s*mercury|mercury\s*card\s*payment/i,
    category: 'TRANSFER',
    confidence: 0.95,
  },
  // Subscriptions (SaaS, cloud, hosting)
  {
    pattern: /aws|amazon web services|vercel|netlify|heroku|digitalocean|google cloud|azure|cloudflare|github|gitlab|stripe|slack|notion|figma|adobe/i,
    category: 'SUBSCRIPTION',
    confidence: 0.80,
  },
  // Overhead (rent, utilities, insurance, office)
  {
    pattern: /rent|lease|utilities|insurance|office|electricity|water|gas|internet|phone/i,
    category: 'OVERHEAD',
    confidence: 0.75,
  },
  // Payroll (salaries, wages, compensation)
  {
    pattern: /payroll|salary|wages|compensation|benefits|tax withholding/i,
    category: 'PAYROLL',
    confidence: 0.70,
  },
  // Tools (software, hardware, equipment)
  {
    pattern: /software|hardware|equipment|computer|laptop|monitor|keyboard|mouse/i,
    category: 'TOOLS',
    confidence: 0.70,
  },
  // Marketing (ads, campaigns, promotion)
  {
    pattern: /advertising|facebook ads|google ads|linkedin ads|marketing|promotion|campaign/i,
    category: 'MARKETING',
    confidence: 0.75,
  },
];

/**
 * Categorize transaction using priority cascade
 *
 * Priority order:
 * 1. Contractor match (if provided)
 * 1.5. Merchant-scoped rules (if merchantNameScope provided — PER_TRANSACTION mode)
 * 2. Admin-defined global rules
 * 3. Default keyword patterns
 * 4. OTHER (fallback)
 *
 * @param transaction - Transaction details
 * @param organizationId - Organization ID
 * @param contractorId - Contractor ID if merchant was mapped
 * @param merchantNameScope - Merchant name for PER_TRANSACTION scoped rules
 * @returns Categorization result with category and confidence
 */
export async function categorizeTransaction(
  transaction: {
    merchantName: string;
    description: string | null;
    amount: number;
  },
  organizationId: string,
  contractorId?: string | null,
  merchantNameScope?: string | null
): Promise<CategorizationResult> {
  // Priority 1: If contractor/vendor match exists, categorize as CONTRACTOR_COST
  if (contractorId) {
    return {
      category: 'CONTRACTOR_COST',
      confidence: 0.95,
      contractor_id: contractorId,
    };
  }

  // Priority 1.5: Merchant-scoped rules (PER_TRANSACTION mode)
  if (merchantNameScope) {
    const scopedRules = await getMerchantScopedRules(organizationId, merchantNameScope);

    for (const rule of scopedRules) {
      if (matchesRule(transaction, rule)) {
        return {
          category: rule.category,
          confidence: 0.92,
          rule_id: rule.id,
          contractor_id: rule.contractor_id ?? undefined,
          subscription_id: rule.subscription_id ?? undefined,
          agency_id: rule.agency_id ?? undefined,
          client_id: rule.client_id ?? undefined,
          expense_category_id: rule.expense_category_id ?? undefined,
          staff_id: rule.staff_id ?? undefined,
        };
      }
    }
  }

  // Priority 2: Check admin-defined global rules (sorted by priority)
  const rules = await getCategorizationRules(organizationId);

  for (const rule of rules) {
    if (matchesRule(transaction, rule)) {
      return {
        category: rule.category,
        confidence: 0.90,
        rule_id: rule.id,
      };
    }
  }

  // Priority 3: Check default keyword patterns
  for (const defaultPattern of DEFAULT_PATTERNS) {
    const textToMatch = `${transaction.merchantName} ${transaction.description || ''}`;

    if (defaultPattern.pattern.test(textToMatch)) {
      return {
        category: defaultPattern.category,
        confidence: defaultPattern.confidence,
      };
    }
  }

  // Priority 4: Uncategorized fallback
  return {
    category: 'OTHER',
    confidence: 0.0,
  };
}

/**
 * Bulk categorize transactions
 * Optimized version that loads rules once
 *
 * @param transactions - Array of transactions to categorize
 * @param organizationId - Organization ID
 * @returns Array of categorization results
 */
export async function bulkCategorizeTransactions(
  transactions: Array<{
    merchantName: string;
    description: string | null;
    amount: number;
    contractorId?: string | null;
  }>,
  organizationId: string
): Promise<CategorizationResult[]> {
  // Load rules once for all transactions
  const rules = await getCategorizationRules(organizationId);

  return transactions.map((transaction) => {
    // Priority 1: Contractor match
    if (transaction.contractorId) {
      return {
        category: 'CONTRACTOR_COST' as ExpenseCategory,
        confidence: 0.95,
        contractor_id: transaction.contractorId,
      };
    }

    // Priority 2: Admin-defined rules
    for (const rule of rules) {
      if (matchesRule(transaction, rule)) {
        return {
          category: rule.category,
          confidence: 0.90,
          rule_id: rule.id,
        };
      }
    }

    // Priority 3: Default patterns
    for (const defaultPattern of DEFAULT_PATTERNS) {
      const textToMatch = `${transaction.merchantName} ${transaction.description || ''}`;

      if (defaultPattern.pattern.test(textToMatch)) {
        return {
          category: defaultPattern.category,
          confidence: defaultPattern.confidence,
        };
      }
    }

    // Priority 4: Uncategorized
    return {
      category: 'OTHER' as ExpenseCategory,
      confidence: 0.0,
    };
  });
}

/**
 * Re-categorize all expense records for a PER_TRANSACTION merchant
 * Called after rule CRUD operations to update existing records
 *
 * @param organizationId - Organization ID
 * @param merchantName - Merchant name to re-categorize
 * @returns Count of updated expense records
 */
export async function recategorizePerTransactionMerchant(
  organizationId: string,
  merchantName: string
): Promise<{ updated: number }> {
  // Fetch all expense records for this merchant
  const records = await prisma.expenseRecord.findMany({
    where: {
      organization_id: organizationId,
      merchant_name: merchantName,
    },
    select: {
      id: true,
      description: true,
      amount: true,
      merchant_name: true,
    },
  });

  if (records.length === 0) {
    return { updated: 0 };
  }

  // Load merchant-scoped rules once
  const scopedRules = await getMerchantScopedRules(organizationId, merchantName);
  let updated = 0;

  for (const record of records) {
    const transaction = {
      merchantName: record.merchant_name || merchantName,
      description: record.description,
      amount: Number(record.amount),
    };

    // Try merchant-scoped rules first
    let matched = false;
    for (const rule of scopedRules) {
      if (matchesRule(transaction, rule)) {
        await prisma.expenseRecord.update({
          where: { id: record.id },
          data: {
            category: rule.category,
            categorization_confidence: 0.92,
            categorization_rule_id: rule.id,
            // Clear all entity FKs then set the one from the rule (mutual exclusivity)
            contractor_id: rule.contractor_id || null,
            agency_id: rule.agency_id || null,
            subscription_id: rule.subscription_id || null,
            expense_category_id: rule.expense_category_id || null,
            staff_id: rule.staff_id || null,
            client_id: rule.client_id || null,
          },
        });
        matched = true;
        updated++;
        break;
      }
    }

    // If no scoped rule matched, recategorize with global rules
    if (!matched) {
      const result = await categorizeTransaction(transaction, organizationId);
      await prisma.expenseRecord.update({
        where: { id: record.id },
        data: {
          category: result.category as ExpenseCategory,
          categorization_confidence: result.confidence,
          categorization_rule_id: result.rule_id || null,
          contractor_id: result.contractor_id || null,
          agency_id: result.agency_id || null,
          subscription_id: result.subscription_id || null,
          expense_category_id: result.expense_category_id || null,
          staff_id: result.staff_id || null,
          client_id: result.client_id || null,
        },
      });
      updated++;
    }
  }

  return { updated };
}
