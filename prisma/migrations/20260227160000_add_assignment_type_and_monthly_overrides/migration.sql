-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PROJECT', 'RETAINER');

-- AlterTable: Add assignment_type to staff_assignments (defaults to RETAINER for existing rows)
ALTER TABLE "staff_assignments" ADD COLUMN "assignment_type" "AssignmentType" NOT NULL DEFAULT 'RETAINER';

-- CreateTable: Monthly allocation overrides for month-specific allocation percentages
CREATE TABLE "monthly_allocation_overrides" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_allocation_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_allocation_overrides_assignment_id_idx" ON "monthly_allocation_overrides"("assignment_id");

-- CreateIndex
CREATE INDEX "monthly_allocation_overrides_year_month_idx" ON "monthly_allocation_overrides"("year", "month");

-- CreateIndex: One override per assignment per month
CREATE UNIQUE INDEX "monthly_allocation_overrides_assignment_id_month_year_key" ON "monthly_allocation_overrides"("assignment_id", "month", "year");

-- AddForeignKey: Cascade delete when assignment is removed
ALTER TABLE "monthly_allocation_overrides" ADD CONSTRAINT "monthly_allocation_overrides_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "staff_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
