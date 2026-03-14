/**
 * Xero Expense Categorization Service
 *
 * Implements smart expense categorization using configurable rules:
 * 1. Contractor detection (payee name similarity to contractors)
 * 2. Account code pattern matching (e.g., 6% → CONTRACTOR)
 * 3. Keyword pattern matching in description (e.g., "subscription|saas" → SUBSCRIPTION)
 * 4. Fallback to OTHER (requires manual categorization)
 *
 * Target: 90% auto-categorization accuracy
 */

import { PrismaClient, ExpenseType } from '@prisma/client';
import { compareTwoStrings, findBestMatch } from 'string-similarity';
import { normalizeName } from './contact-mapper';

const prisma = new PrismaClient();

const CONTRACTOR_NAME_SIMILARITY_THRESHOLD = 0.8;

export interface XeroExpense {
  id: string;
  date: Date;
  amount: number;
  payee?: string;
  description?: string;
  accountCode?: string;
}

export interface CategorizationResult {
  type: ExpenseType;
  contractorId: string | null;
  confidence: number;
  matchedRule?: string;
}

/**
 * Find contractor by name using string similarity
 *
 * @param organizationId - Organization UUID
 * @param payeeName - Payee name from Xero expense
 * @returns Contractor ID and similarity score if match found
 */
export async function findContractorByName(
  organizationId: string,
  payeeName: string
): Promise<{ contractorId: string; score: number } | null> {
  if (!payeeName) return null;

  // Get all contractors for this organization
  const contractors = await prisma.contractor.findMany({
    where: {
      organization_id: organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (contractors.length === 0) return null;

  const normalizedPayee = normalizeName(payeeName);
  const contractorNames = contractors.map((c) => normalizeName(c.name));

  // Find best match using string similarity
  const bestMatch = findBestMatch(normalizedPayee, contractorNames);

  if (bestMatch.bestMatch.rating >= CONTRACTOR_NAME_SIMILARITY_THRESHOLD) {
    return {
      contractorId: contractors[bestMatch.bestMatchIndex].id,
      score: bestMatch.bestMatch.rating,
    };
  }

  return null;
}

/**
 * Find expense mapping by account code pattern
 *
 * @param connectionId - Xero connection UUID
 * @param accountCode - Account code from Xero expense
 * @returns Expense type and matching rule if found
 */
export async function findExpenseMappingByAccountCode(
  connectionId: string,
  accountCode: string
): Promise<{ type: ExpenseType; rule: string } | null> {
  if (!accountCode) return null;

  // Get all account code mappings for this connection, ordered by priority
  const mappings = await prisma.xeroExpenseCategoryMapping.findMany({
    where: {
      connection_id: connectionId,
      is_active: true,
      account_code_pattern: { not: null },
    },
    orderBy: {
      priority: 'desc', // Higher priority first
    },
  });

  // Test each pattern
  for (const mapping of mappings) {
    if (!mapping.account_code_pattern) continue;

    const pattern = mapping.account_code_pattern;

    // Simple wildcard matching (e.g., "6%" matches "600", "620", etc.)
    if (pattern.includes('%')) {
      const prefix = pattern.replace('%', '');
      if (accountCode.startsWith(prefix)) {
        return {
          type: mapping.expense_type,
          rule: `Account code ${accountCode} matches pattern ${pattern}`,
        };
      }
    }

    // Exact match
    if (pattern === accountCode) {
      return {
        type: mapping.expense_type,
        rule: `Account code ${accountCode} exact match`,
      };
    }
  }

  return null;
}

/**
 * Find expense mapping by keywords in description
 *
 * @param connectionId - Xero connection UUID
 * @param description - Expense description from Xero
 * @returns Expense type and matching rule if found
 */
export async function findExpenseMappingByKeywords(
  connectionId: string,
  description: string
): Promise<{ type: ExpenseType; rule: string } | null> {
  if (!description) return null;

  const normalizedDesc = description.toLowerCase();

  // Get all keyword mappings for this connection, ordered by priority
  const mappings = await prisma.xeroExpenseCategoryMapping.findMany({
    where: {
      connection_id: connectionId,
      is_active: true,
      keyword_pattern: { not: null },
    },
    orderBy: {
      priority: 'desc',
    },
  });

  // Test each keyword pattern (regex)
  for (const mapping of mappings) {
    if (!mapping.keyword_pattern) continue;

    try {
      // Keyword pattern is a regex-like string (e.g., "subscription|saas|software")
      const regex = new RegExp(mapping.keyword_pattern, 'i');

      if (regex.test(normalizedDesc)) {
        return {
          type: mapping.expense_type,
          rule: `Description "${description}" matches keywords: ${mapping.keyword_pattern}`,
        };
      }
    } catch (error) {
      console.error(
        `Invalid keyword pattern: ${mapping.keyword_pattern}`,
        error
      );
      continue;
    }
  }

  return null;
}

/**
 * Categorize expense using tiered strategy
 *
 * Strategy:
 * 1. Contractor detection (payee name similarity ≥ 0.8)
 * 2. Account code pattern matching
 * 3. Keyword pattern matching in description
 * 4. Fallback to OTHER
 *
 * @param organizationId - Organization UUID
 * @param connectionId - Xero connection UUID
 * @param expense - Xero expense data
 * @returns Categorization result with type, contractor_id, confidence
 */
export async function categorizeExpense(
  organizationId: string,
  connectionId: string,
  expense: XeroExpense
): Promise<CategorizationResult> {
  // Strategy 1: Check if payee is a known contractor
  if (expense.payee) {
    const contractor = await findContractorByName(organizationId, expense.payee);

    if (contractor) {
      return {
        type: 'CONTRACTOR',
        contractorId: contractor.contractorId,
        confidence: contractor.score,
        matchedRule: `Payee "${expense.payee}" matched contractor (${Math.round(contractor.score * 100)}% similarity)`,
      };
    }
  }

  // Strategy 2: Check account code pattern
  if (expense.accountCode) {
    const accountCodeMatch = await findExpenseMappingByAccountCode(
      connectionId,
      expense.accountCode
    );

    if (accountCodeMatch) {
      return {
        type: accountCodeMatch.type,
        contractorId: null,
        confidence: 0.9,
        matchedRule: accountCodeMatch.rule,
      };
    }
  }

  // Strategy 3: Check keyword pattern in description
  if (expense.description) {
    const keywordMatch = await findExpenseMappingByKeywords(
      connectionId,
      expense.description
    );

    if (keywordMatch) {
      return {
        type: keywordMatch.type,
        contractorId: null,
        confidence: 0.8,
        matchedRule: keywordMatch.rule,
      };
    }
  }

  // Strategy 4: Fallback to OTHER (manual categorization required)
  return {
    type: 'OTHER',
    contractorId: null,
    confidence: 0.0,
    matchedRule: 'No categorization rule matched',
  };
}
