-- CreateEnum
CREATE TYPE "EquityTransactionType" AS ENUM ('GRANT', 'TRANSFER', 'PURCHASE', 'CANCELLATION');

-- CreateTable
CREATE TABLE "cap_table_stakeholders" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255),
    "role_title" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cap_table_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_table_share_classes" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "authorized_shares" INTEGER NOT NULL,
    "reserved_shares" INTEGER NOT NULL DEFAULT 0,
    "price_per_share" DECIMAL(12,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cap_table_share_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_table_equity_holdings" (
    "id" UUID NOT NULL,
    "stakeholder_id" UUID NOT NULL,
    "share_class_id" UUID NOT NULL,
    "shares_held" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cap_table_equity_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_table_equity_transactions" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "transaction_type" "EquityTransactionType" NOT NULL,
    "transaction_date" DATE NOT NULL,
    "share_class_id" UUID NOT NULL,
    "from_stakeholder_id" UUID,
    "to_stakeholder_id" UUID,
    "shares_affected" INTEGER NOT NULL,
    "price_per_share" DECIMAL(12,4),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cap_table_equity_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cap_table_stakeholders_organization_id_idx" ON "cap_table_stakeholders"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cap_table_stakeholders_organization_id_email_key" ON "cap_table_stakeholders"("organization_id", "email");

-- CreateIndex
CREATE INDEX "cap_table_share_classes_organization_id_idx" ON "cap_table_share_classes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cap_table_share_classes_organization_id_name_key" ON "cap_table_share_classes"("organization_id", "name");

-- CreateIndex
CREATE INDEX "cap_table_equity_holdings_stakeholder_id_idx" ON "cap_table_equity_holdings"("stakeholder_id");

-- CreateIndex
CREATE INDEX "cap_table_equity_holdings_share_class_id_idx" ON "cap_table_equity_holdings"("share_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "cap_table_equity_holdings_stakeholder_id_share_class_id_key" ON "cap_table_equity_holdings"("stakeholder_id", "share_class_id");

-- CreateIndex
CREATE INDEX "cap_table_equity_transactions_organization_id_idx" ON "cap_table_equity_transactions"("organization_id");

-- CreateIndex
CREATE INDEX "cap_table_equity_transactions_organization_id_transaction_d_idx" ON "cap_table_equity_transactions"("organization_id", "transaction_date");

-- CreateIndex
CREATE INDEX "cap_table_equity_transactions_from_stakeholder_id_idx" ON "cap_table_equity_transactions"("from_stakeholder_id");

-- CreateIndex
CREATE INDEX "cap_table_equity_transactions_to_stakeholder_id_idx" ON "cap_table_equity_transactions"("to_stakeholder_id");

-- CreateIndex
CREATE INDEX "cap_table_equity_transactions_share_class_id_idx" ON "cap_table_equity_transactions"("share_class_id");

-- AddForeignKey
ALTER TABLE "cap_table_stakeholders" ADD CONSTRAINT "cap_table_stakeholders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_share_classes" ADD CONSTRAINT "cap_table_share_classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_equity_holdings" ADD CONSTRAINT "cap_table_equity_holdings_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "cap_table_stakeholders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_equity_holdings" ADD CONSTRAINT "cap_table_equity_holdings_share_class_id_fkey" FOREIGN KEY ("share_class_id") REFERENCES "cap_table_share_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_equity_transactions" ADD CONSTRAINT "cap_table_equity_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_equity_transactions" ADD CONSTRAINT "cap_table_equity_transactions_share_class_id_fkey" FOREIGN KEY ("share_class_id") REFERENCES "cap_table_share_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_equity_transactions" ADD CONSTRAINT "cap_table_equity_transactions_from_stakeholder_id_fkey" FOREIGN KEY ("from_stakeholder_id") REFERENCES "cap_table_stakeholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_equity_transactions" ADD CONSTRAINT "cap_table_equity_transactions_to_stakeholder_id_fkey" FOREIGN KEY ("to_stakeholder_id") REFERENCES "cap_table_stakeholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
