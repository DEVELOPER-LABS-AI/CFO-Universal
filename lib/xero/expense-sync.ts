/**
 * Xero Expense Sync Service
 *
 * Syncs bills and bank transactions (SPEND type) from Xero to expense_records.
 *
 * Flow:
 * 1. Get last_sync_at timestamp (incremental sync)
 * 2. Fetch bills and bank transactions from Xero API
 * 3. Categorize expenses using smart categorization
 * 4. Create/update expense records
 * 5. Update sync timestamp and counts
 *
 * Handles duplicate prevention with upsert on xero_expense_id.
 */

import { XeroClient } from 'xero-node';
import { PrismaClient, ExpenseCategory } from '@prisma/client';
import { categorizeExpense, XeroExpense } from './expense-categorizer';

const prisma = new PrismaClient();

/**
 * Map ExpenseType to ExpenseCategory
 * ExpenseType is used for categorization logic
 * ExpenseCategory is the schema enum for storage
 */
function mapExpenseTypeToCategory(expenseType: string): ExpenseCategory {
  const mapping: Record<string, ExpenseCategory> = {
    CONTRACTOR: 'CONTRACTOR_COST',
    SUBSCRIPTION: 'SUBSCRIPTION',
    OVERHEAD: 'OVERHEAD',
    OTHER: 'OTHER',
  };
  return mapping[expenseType] || 'OTHER';
}

export interface ExpenseSyncResult {
  expensesProcessed: number;
  expensesFailed: number;
  expensesCategorized: number;
  expensesUncategorized: number;
  errors: any[];
}

/**
 * Sync expenses (bills + bank transactions) from Xero to expense records
 *
 * @param organizationId - Organization UUID
 * @param connectionId - Xero connection UUID
 * @param xeroClient - Initialized Xero client
 * @param tenantId - Xero tenant ID
 * @returns Sync result with counts and errors
 */
export async function syncExpenses(
  organizationId: string,
  connectionId: string,
  xeroClient: XeroClient,
  tenantId: string
): Promise<ExpenseSyncResult> {
  const result: ExpenseSyncResult = {
    expensesProcessed: 0,
    expensesFailed: 0,
    expensesCategorized: 0,
    expensesUncategorized: 0,
    errors: [],
  };

  try {
    // Get last sync timestamp for incremental sync
    const connection = await prisma.xeroConnection.findUnique({
      where: { id: connectionId },
      select: { last_sync_at: true },
    });

    const lastSyncAt = connection?.last_sync_at;

    console.log(
      `Syncing expenses for organization ${organizationId}`,
      lastSyncAt ? `since ${lastSyncAt.toISOString()}` : '(full sync)'
    );

    // Fetch bills from Xero API (bills are invoices with Type=ACCPAY)
    console.log('Fetching bills from Xero...');
    const billsResponse = await xeroClient.accountingApi.getInvoices(
      tenantId,
      lastSyncAt || undefined, // ModifiedAfter as Date | undefined
      'Type=="ACCPAY"' // Filter for bills (accounts payable)
    );

    const bills = billsResponse.body.invoices || [];
    console.log(`Fetched ${bills.length} bills from Xero`);

    // Fetch bank transactions (SPEND type only)
    console.log('Fetching bank transactions from Xero...');
    const bankTxResponse = await xeroClient.accountingApi.getBankTransactions(
      tenantId,
      lastSyncAt || undefined, // ModifiedAfter as Date | undefined
      'Type=="SPEND"' // Only SPEND transactions (outgoing payments)
    );

    const bankTransactions = bankTxResponse.body.bankTransactions || [];
    console.log(`Fetched ${bankTransactions.length} bank transactions from Xero`);

    // Process bills
    for (const bill of bills) {
      try {
        result.expensesProcessed++;

        if (!bill.invoiceID) {
          throw new Error('Missing bill ID');
        }

        // Extract expense data
        const expense: XeroExpense = {
          id: bill.invoiceID,
          date: bill.date ? new Date(bill.date) : new Date(),
          amount: bill.total || 0,
          payee: bill.contact?.name,
          description: bill.reference || `Bill ${bill.invoiceNumber}`,
          accountCode: bill.lineItems?.[0]?.accountCode, // Use first line item account code
        };

        // Categorize expense
        const categorization = await categorizeExpense(
          organizationId,
          connectionId,
          expense
        );

        // Determine sync status
        const syncStatus =
          categorization.type === 'OTHER'
            ? ('CATEGORIZATION_FAILED' as const)
            : ('SYNCED' as const);

        // Map ExpenseType to ExpenseCategory
        const mappedCategory = mapExpenseTypeToCategory(categorization.type);

        // Prepare expense record data with correct field names
        const expenseRecordData = {
          organization_id: organizationId,
          xero_expense_id: bill.invoiceID,
          xero_account_code: expense.accountCode || null,
          contractor_id: categorization.contractorId,
          category: mappedCategory,
          amount: expense.amount,
          transaction_date: expense.date, // Correct field name
          description: expense.description,
          sync_source: 'XERO' as any,
          expense_sync_status: syncStatus,
          last_synced_at: new Date(),
        };

        // Upsert expense record (handle duplicates)
        await prisma.expenseRecord.upsert({
          where: {
            organization_id_xero_expense_id: {
              organization_id: organizationId,
              xero_expense_id: bill.invoiceID,
            },
          },
          update: {
            xero_account_code: expenseRecordData.xero_account_code,
            contractor_id: expenseRecordData.contractor_id,
            category: expenseRecordData.category,
            amount: expenseRecordData.amount,
            transaction_date: expenseRecordData.transaction_date,
            description: expenseRecordData.description,
            expense_sync_status: expenseRecordData.expense_sync_status,
            last_synced_at: expenseRecordData.last_synced_at,
            updated_at: new Date(),
          },
          create: expenseRecordData,
        });

        // Update counts
        if (syncStatus === 'SYNCED') {
          result.expensesCategorized++;
        } else {
          result.expensesUncategorized++;
          result.errors.push({
            type: 'CATEGORIZATION_FAILED',
            expense_id: bill.invoiceID,
            bill_number: bill.invoiceNumber,
            payee: expense.payee,
            message: categorization.matchedRule,
          });
        }
      } catch (error) {
        result.expensesFailed++;
        result.errors.push({
          type: 'EXPENSE_SYNC_ERROR',
          expense_id: bill.invoiceID,
          bill_number: bill.invoiceNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error(`Failed to sync bill ${bill.invoiceNumber}:`, error);
      }
    }

    // Process bank transactions
    for (const tx of bankTransactions) {
      try {
        result.expensesProcessed++;

        if (!tx.bankTransactionID) {
          throw new Error('Missing bank transaction ID');
        }

        // Extract expense data
        const expense: XeroExpense = {
          id: tx.bankTransactionID,
          date: tx.date ? new Date(tx.date) : new Date(),
          amount: tx.total || 0,
          payee: tx.contact?.name,
          description: tx.reference || `Bank Transaction`,
          accountCode: tx.lineItems?.[0]?.accountCode,
        };

        // Categorize expense
        const categorization = await categorizeExpense(
          organizationId,
          connectionId,
          expense
        );

        // Determine sync status
        const syncStatus =
          categorization.type === 'OTHER'
            ? ('CATEGORIZATION_FAILED' as const)
            : ('SYNCED' as const);

        // Map ExpenseType to ExpenseCategory
        const mappedCategory = mapExpenseTypeToCategory(categorization.type);

        // Prepare expense record data with correct field names
        const expenseRecordData = {
          organization_id: organizationId,
          xero_expense_id: tx.bankTransactionID,
          xero_account_code: expense.accountCode || null,
          contractor_id: categorization.contractorId,
          category: mappedCategory,
          amount: expense.amount,
          transaction_date: expense.date, // Correct field name
          description: expense.description,
          sync_source: 'XERO' as any,
          expense_sync_status: syncStatus,
          last_synced_at: new Date(),
        };

        // Upsert expense record (handle duplicates)
        await prisma.expenseRecord.upsert({
          where: {
            organization_id_xero_expense_id: {
              organization_id: organizationId,
              xero_expense_id: tx.bankTransactionID,
            },
          },
          update: {
            xero_account_code: expenseRecordData.xero_account_code,
            contractor_id: expenseRecordData.contractor_id,
            category: expenseRecordData.category,
            amount: expenseRecordData.amount,
            transaction_date: expenseRecordData.transaction_date,
            description: expenseRecordData.description,
            expense_sync_status: expenseRecordData.expense_sync_status,
            last_synced_at: expenseRecordData.last_synced_at,
            updated_at: new Date(),
          },
          create: expenseRecordData,
        });

        // Update counts
        if (syncStatus === 'SYNCED') {
          result.expensesCategorized++;
        } else {
          result.expensesUncategorized++;
          result.errors.push({
            type: 'CATEGORIZATION_FAILED',
            expense_id: tx.bankTransactionID,
            payee: expense.payee,
            message: categorization.matchedRule,
          });
        }
      } catch (error) {
        result.expensesFailed++;
        result.errors.push({
          type: 'EXPENSE_SYNC_ERROR',
          expense_id: tx.bankTransactionID,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error(`Failed to sync bank transaction:`, error);
      }
    }

    console.log('Expense sync result:', result);
    return result;
  } catch (error) {
    // Fatal error - couldn't fetch expenses
    result.errors.push({
      type: 'API_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
