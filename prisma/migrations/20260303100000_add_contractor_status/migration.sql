-- Add ContractorStatus enum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Add status column with default ACTIVE (backfills all existing rows)
ALTER TABLE "core_contractors" ADD COLUMN "status" "ContractorStatus" NOT NULL DEFAULT 'ACTIVE';

-- Add index for status filtering
CREATE INDEX "core_contractors_status_idx" ON "core_contractors"("status");
