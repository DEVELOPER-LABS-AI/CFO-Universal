-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum (add timesheet notification types)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TIMESHEET_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TIMESHEET_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TIMESHEET_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TIMESHEET_REMINDER';

-- CreateTable
CREATE TABLE "overtime_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "weekly_hours_threshold" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "total_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "billable_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "rejection_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "timesheet_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "project_id" UUID,
    "entry_date" DATE NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "description" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "is_overtime" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overtime_configs_organization_id_idx" ON "overtime_configs"("organization_id");

-- CreateIndex
CREATE INDEX "overtime_configs_agency_id_idx" ON "overtime_configs"("agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_configs_organization_id_agency_id_key" ON "overtime_configs"("organization_id", "agency_id");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_idx" ON "timesheets"("organization_id");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_status_idx" ON "timesheets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "timesheets_staff_id_idx" ON "timesheets"("staff_id");

-- CreateIndex
CREATE INDEX "timesheets_staff_id_period_start_idx" ON "timesheets"("staff_id", "period_start");

-- CreateIndex
CREATE INDEX "timesheets_status_idx" ON "timesheets"("status");

-- CreateIndex
CREATE INDEX "timesheets_period_start_period_end_idx" ON "timesheets"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "timesheets_reviewed_by_idx" ON "timesheets"("reviewed_by");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_staff_id_period_start_key" ON "timesheets"("staff_id", "period_start");

-- CreateIndex
CREATE INDEX "time_entries_timesheet_id_idx" ON "time_entries"("timesheet_id");

-- CreateIndex
CREATE INDEX "time_entries_staff_id_idx" ON "time_entries"("staff_id");

-- CreateIndex
CREATE INDEX "time_entries_assignment_id_idx" ON "time_entries"("assignment_id");

-- CreateIndex
CREATE INDEX "time_entries_project_id_idx" ON "time_entries"("project_id");

-- CreateIndex
CREATE INDEX "time_entries_entry_date_idx" ON "time_entries"("entry_date");

-- CreateIndex
CREATE INDEX "time_entries_timesheet_id_entry_date_idx" ON "time_entries"("timesheet_id", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_timesheet_id_entry_date_assignment_id_key" ON "time_entries"("timesheet_id", "entry_date", "assignment_id");

-- AddForeignKey
ALTER TABLE "overtime_configs" ADD CONSTRAINT "overtime_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_configs" ADD CONSTRAINT "overtime_configs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "staff_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
