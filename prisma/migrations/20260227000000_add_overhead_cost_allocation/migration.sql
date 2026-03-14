-- Add overhead cost allocation fields

-- Organization: toggle for including owner pay in overhead spreading
ALTER TABLE "core_organizations" ADD COLUMN "include_owner_pay" BOOLEAN NOT NULL DEFAULT true;

-- ClientROI: additional cost breakdown columns
ALTER TABLE "client_roi" ADD COLUMN "overhead_costs" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "client_roi" ADD COLUMN "agency_costs" DECIMAL(10,2) NOT NULL DEFAULT 0;
