-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'TERMINATED');

-- AlterTable: Add termination fields to staff
ALTER TABLE "staff" ADD COLUMN "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "staff" ADD COLUMN "terminated_at" TIMESTAMP(3);
ALTER TABLE "staff" ADD COLUMN "termination_reason" TEXT;

-- CreateIndex
CREATE INDEX "staff_organization_id_status_idx" ON "staff"("organization_id", "status");
