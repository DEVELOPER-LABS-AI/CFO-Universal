-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('CONTRACT', 'PROJECT', 'RETAINER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "billing_model" "BillingModel" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_month" INTEGER NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_month" INTEGER,
    "end_year" INTEGER,
    "monthly_rate" DECIMAL(10,2),
    "project_fee" DECIMAL(10,2),
    "term_months" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_contracts_client_id_service_id_status_idx" ON "service_contracts"("client_id", "service_id", "status");

-- CreateIndex
CREATE INDEX "service_contracts_organization_id_idx" ON "service_contracts"("organization_id");

-- CreateIndex
CREATE INDEX "service_contracts_client_id_start_year_start_month_idx" ON "service_contracts"("client_id", "start_year", "start_month");

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
