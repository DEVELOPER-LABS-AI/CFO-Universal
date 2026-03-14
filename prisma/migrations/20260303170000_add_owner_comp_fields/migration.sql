-- AlterTable: Add owner compensation tracking fields
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "compensation_start_date" TIMESTAMP(3);
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "pay_day" INTEGER;
