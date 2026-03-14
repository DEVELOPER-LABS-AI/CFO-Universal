-- Add is_credit boolean to financial_expense_records
-- true = income/credit (positive Mercury amount), false = expense/debit (negative Mercury amount)
ALTER TABLE "financial_expense_records" ADD COLUMN "is_credit" BOOLEAN NOT NULL DEFAULT false;
