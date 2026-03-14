-- CreateEnum
CREATE TYPE "MarkupType" AS ENUM ('PERCENTAGE', 'FLAT_RATE');

-- CreateEnum
CREATE TYPE "MarkupBasis" AS ENUM ('BASE_PAY', 'TOTAL_COMPENSATION');

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "markup_basis" "MarkupBasis",
ADD COLUMN     "markup_type" "MarkupType",
ADD COLUMN     "markup_value" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "markup_override_type" "MarkupType",
ADD COLUMN     "markup_override_value" DECIMAL(10,2),
ADD COLUMN     "rate_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "true_cost" DECIMAL(10,2),
ADD COLUMN     "true_cost_rate_type" "RateType";
