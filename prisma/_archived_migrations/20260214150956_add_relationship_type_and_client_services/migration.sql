-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED', 'CUSTOM');

-- Step 1: Normalize existing data to match enum values
UPDATE "core_clients"
SET "relationship_type" = CASE
  WHEN UPPER("relationship_type") = 'RETAINER' THEN 'RETAINER'
  WHEN UPPER("relationship_type") = 'PROJECT' OR UPPER("relationship_type") = 'PROJECT_BASED' THEN 'PROJECT_BASED'
  WHEN UPPER("relationship_type") = 'HOURLY' THEN 'HOURLY'
  WHEN UPPER("relationship_type") = 'VALUE_BASED' OR UPPER("relationship_type") = 'VALUE BASED' THEN 'VALUE_BASED'
  WHEN UPPER("relationship_type") = 'CUSTOM' THEN 'CUSTOM'
  WHEN "relationship_type" IS NULL THEN 'RETAINER'
  ELSE 'CUSTOM'
END
WHERE "relationship_type" IS NOT NULL OR "relationship_type" IS NULL;

-- Step 2: Convert column to enum type
ALTER TABLE "core_clients"
  ALTER COLUMN "relationship_type" TYPE "RelationshipType"
  USING ("relationship_type"::text::"RelationshipType");

-- Step 3: Make it NOT NULL with default
ALTER TABLE "core_clients"
  ALTER COLUMN "relationship_type" SET NOT NULL,
  ALTER COLUMN "relationship_type" SET DEFAULT 'RETAINER'::"RelationshipType";

-- CreateTable: ClientService join table
CREATE TABLE "core_client_services" (
    "client_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_client_services_pkey" PRIMARY KEY ("client_id","service_id")
);

-- CreateIndex
CREATE INDEX "core_client_services_client_id_idx" ON "core_client_services"("client_id");

-- CreateIndex
CREATE INDEX "core_client_services_service_id_idx" ON "core_client_services"("service_id");

-- AddForeignKey
ALTER TABLE "core_client_services" ADD CONSTRAINT "core_client_services_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_client_services" ADD CONSTRAINT "core_client_services_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
