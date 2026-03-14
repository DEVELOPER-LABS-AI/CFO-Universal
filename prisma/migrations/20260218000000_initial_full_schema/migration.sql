-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CHURNED');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('FULL_TIME', 'PART_TIME', 'PROJECT');

-- CreateEnum
CREATE TYPE "RevenueStatus" AS ENUM ('INVOICED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('XERO', 'MERCURY', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('CONTRACTOR_COST', 'SUBSCRIPTION', 'TOOLS', 'PAYROLL', 'OVERHEAD', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('XERO', 'SLACK', 'MERCURY');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TargetScope" AS ENUM ('GLOBAL', 'SERVICE', 'CLIENT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EXECUTIVE', 'ANALYST');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('USER_CREATED', 'USER_EDITED', 'USER_DELETED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'ROLE_CHANGED', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('BDR', 'ADMIN', 'CONTRACTOR', 'AGENCY_STAFF');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('SEAT_BASED', 'PERCENTAGE_BASED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'TOKEN_EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "XeroSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('INVOICES', 'EXPENSES', 'CONTACTS', 'FULL');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY');

-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('EMAIL_EXACT', 'NAME_EXACT', 'NAME_FUZZY', 'MANUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('XERO_INVOICE_CREATED', 'XERO_INVOICE_UPDATED', 'XERO_CONTACT_CREATED', 'XERO_CONTACT_UPDATED', 'SYNC_COMPLETED', 'SYNC_FAILED', 'INTEGRATION_ERROR', 'SYSTEM_ALERT', 'INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('CONTRACTOR', 'SUBSCRIPTION', 'OVERHEAD', 'OTHER');

-- CreateEnum
CREATE TYPE "RevenueSyncStatus" AS ENUM ('SYNCED', 'MAPPING_FAILED', 'VALIDATION_FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExpenseSyncStatus" AS ENUM ('SYNCED', 'CATEGORIZATION_FAILED', 'VALIDATION_FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "mercury_connection_status" AS ENUM ('ACTIVE', 'DISCONNECTED', 'API_ERROR');

-- CreateEnum
CREATE TYPE "mercury_sync_type" AS ENUM ('TRANSACTIONS', 'BALANCES', 'FULL');

-- CreateEnum
CREATE TYPE "mercury_sync_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "mercury_sync_trigger" AS ENUM ('SYSTEM', 'MANUAL', 'RETRY');

-- CreateEnum
CREATE TYPE "mapping_confidence" AS ENUM ('EXACT', 'FUZZY', 'MANUAL');

-- CreateEnum
CREATE TYPE "mapping_source" AS ENUM ('SYSTEM', 'ADMIN_USER');

-- CreateEnum
CREATE TYPE "categorization_rule_type" AS ENUM ('MERCHANT_NAME', 'DESCRIPTION_KEYWORD', 'AMOUNT_RANGE');

-- CreateEnum
CREATE TYPE "mercury_account_type" AS ENUM ('CHECKING', 'SAVINGS', 'TREASURY');

-- CreateEnum
CREATE TYPE "expense_record_sync_status" AS ENUM ('MANUAL', 'SYNCED', 'CATEGORIZATION_FAILED', 'MAPPING_FAILED');

-- CreateTable
CREATE TABLE "core_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "preferences" JSONB,
    "last_active_org" TEXT,
    "role" "UserRole" DEFAULT 'EXECUTIVE',
    "status" "UserStatus" DEFAULT 'ACTIVE',
    "last_login" TIMESTAMP(3),
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_clients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "relationship_type" "RelationshipType" NOT NULL,
    "custom_margin_target" DECIMAL(5,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "churn_date" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_services" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standard_rate" DECIMAL(10,2) NOT NULL,
    "target_margin" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_contractors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_contractor_assignments" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "allocation_percentage" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_contractor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_client_services" (
    "client_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "custom_rate" DECIMAL(10,2),
    "rate_type" "RateType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_client_services_pkey" PRIMARY KEY ("client_id","service_id")
);

-- CreateTable
CREATE TABLE "financial_revenue_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "status" "RevenueStatus" NOT NULL,
    "description" TEXT,
    "external_id" TEXT,
    "sync_source" "SyncSource" NOT NULL DEFAULT 'MANUAL',
    "xero_invoice_id" TEXT,
    "xero_invoice_number" TEXT,
    "revenue_sync_status" "RevenueSyncStatus",
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_revenue_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_expense_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "contractor_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "external_id" TEXT,
    "sync_source" "SyncSource" NOT NULL DEFAULT 'MANUAL',
    "xero_expense_id" TEXT,
    "xero_account_code" TEXT,
    "expense_sync_status" "ExpenseSyncStatus",
    "last_synced_at" TIMESTAMP(3),
    "mercury_transaction_id" TEXT,
    "merchant_name" TEXT,
    "categorization_confidence" DECIMAL(3,2),
    "mercury_sync_status" "expense_record_sync_status",
    "agency_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_expense_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_client_metrics" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_revenue" DECIMAL(10,2) NOT NULL,
    "total_costs" DECIMAL(10,2) NOT NULL,
    "actual_margin" DECIMAL(5,2) NOT NULL,
    "target_margin" DECIMAL(5,2) NOT NULL,
    "tier_classification" SMALLINT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_client_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_company_metrics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "portfolio_margin" DECIMAL(5,2) NOT NULL,
    "total_revenue" DECIMAL(10,2) NOT NULL,
    "total_expenses" DECIMAL(10,2) NOT NULL,
    "client_count" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_company_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations_oauth_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations_sync_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration_type" TEXT NOT NULL,
    "sync_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_completed_at" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "xero_tenant_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "scopes_granted" TEXT[],
    "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "XeroSyncStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_sync_logs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "sync_type" "SyncType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "invoices_processed" INTEGER NOT NULL DEFAULT 0,
    "invoices_failed" INTEGER NOT NULL DEFAULT 0,
    "expenses_processed" INTEGER NOT NULL DEFAULT 0,
    "expenses_failed" INTEGER NOT NULL DEFAULT 0,
    "contacts_mapped" INTEGER NOT NULL DEFAULT 0,
    "contacts_unmapped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "triggered_by" "SyncTrigger" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_contact_mappings" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "xero_contact_id" TEXT NOT NULL,
    "xero_contact_name" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "mapping_type" "MappingType" NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "mapped_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_contact_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_expense_category_mappings" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "account_code_pattern" TEXT,
    "keyword_pattern" TEXT,
    "expense_type" "ExpenseType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_expense_category_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercury_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "connection_status" "mercury_connection_status" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "mercury_sync_status",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mercury_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercury_sync_logs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "sync_type" "mercury_sync_type" NOT NULL,
    "status" "mercury_sync_status" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "transactions_processed" INTEGER NOT NULL DEFAULT 0,
    "transactions_failed" INTEGER NOT NULL DEFAULT 0,
    "balances_updated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "triggered_by" "mercury_sync_trigger" NOT NULL,
    "triggered_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercury_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_mapping_cache" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "mercury_merchant_name" TEXT NOT NULL,
    "normalized_merchant_name" TEXT NOT NULL,
    "contractor_id" TEXT,
    "agency_id" TEXT,
    "subscription_id" TEXT,
    "mapping_confidence" "mapping_confidence" NOT NULL,
    "confidence_score" DECIMAL(3,2),
    "mapped_by" "mapping_source" NOT NULL,
    "mapped_by_user_id" TEXT,
    "mapped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_mapping_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categorization_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rule_type" "categorization_rule_type" NOT NULL,
    "pattern" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balance_history" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "mercury_account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" "mercury_account_type" NOT NULL,
    "current_balance" DECIMAL(12,2) NOT NULL,
    "available_balance" DECIMAL(12,2) NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_financial_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "TargetScope" NOT NULL,
    "scope_id" TEXT,
    "target_margin" DECIMAL(5,2) NOT NULL,
    "target_revenue" DECIMAL(10,2),
    "fiscal_period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_financial_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_growth_scenarios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "projected_revenue" DECIMAL(10,2) NOT NULL,
    "projected_margin" DECIMAL(5,2) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_growth_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action_type" "AuditActionType" NOT NULL,
    "action_details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" UUID,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "action_url" TEXT,
    "related_entity_type" VARCHAR(100),
    "related_entity_id" TEXT,
    "read_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "organization_id" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "name" TEXT NOT NULL,
    "staff_type" "StaffType" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "total_seats" INTEGER,
    "billing_frequency" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_allocations" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "client_id" TEXT,
    "staff_id" TEXT,
    "allocation_type" "AllocationType" NOT NULL,
    "seats_allocated" INTEGER,
    "percentage_allocated" DECIMAL(5,2),
    "cost_allocated" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_payment" DECIMAL(10,2),
    "merchant_name" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_monthly_breakdowns" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "breakdown_total" DECIMAL(10,2) NOT NULL,
    "mercury_actual" DECIMAL(10,2),
    "variance" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_monthly_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bdr_productivity_metrics" (
    "id" TEXT NOT NULL,
    "bdr_id" TEXT NOT NULL,
    "client_id" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "meetings_attended" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bdr_productivity_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_roi" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL,
    "total_costs" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "roi_percentage" DECIMAL(8,2) NOT NULL,
    "margin_percentage" DECIMAL(5,2) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bdr_costs" DECIMAL(10,2) NOT NULL,
    "contractor_costs" DECIMAL(10,2) NOT NULL,
    "subscription_costs" DECIMAL(10,2) NOT NULL,
    "service_costs" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "client_roi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bdr_roi" (
    "id" TEXT NOT NULL,
    "bdr_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "revenue_attributed" DECIMAL(10,2) NOT NULL,
    "bdr_cost" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "roi_percentage" DECIMAL(8,2) NOT NULL,
    "margin_percentage" DECIMAL(5,2) NOT NULL,
    "meetings_attended_total" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bdr_roi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_transaction_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "mercury_transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "merchant_name" TEXT NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_transaction_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_cash_receipts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "mercury_transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_cash_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_sync_run_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "mercury_sync_log_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "subscription_transactions_created" INTEGER NOT NULL DEFAULT 0,
    "contractor_expense_records_created" INTEGER NOT NULL DEFAULT 0,
    "needs_review_count" INTEGER NOT NULL DEFAULT 0,
    "engine_error_count" INTEGER NOT NULL DEFAULT 0,
    "partial_commit" BOOLEAN NOT NULL DEFAULT false,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_sync_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_organizations_name_key" ON "core_organizations"("name");

-- CreateIndex
CREATE INDEX "user_organizations_user_id_idx" ON "user_organizations"("user_id");

-- CreateIndex
CREATE INDEX "user_organizations_organization_id_idx" ON "user_organizations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_user_id_organization_id_key" ON "user_organizations"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_invite_token_key" ON "user_profiles"("invite_token");

-- CreateIndex
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_role_idx" ON "user_profiles"("role");

-- CreateIndex
CREATE INDEX "user_profiles_status_idx" ON "user_profiles"("status");

-- CreateIndex
CREATE INDEX "user_profiles_invite_token_idx" ON "user_profiles"("invite_token");

-- CreateIndex
CREATE INDEX "core_clients_organization_id_idx" ON "core_clients"("organization_id");

-- CreateIndex
CREATE INDEX "core_clients_status_idx" ON "core_clients"("status");

-- CreateIndex
CREATE INDEX "core_clients_deleted_at_idx" ON "core_clients"("deleted_at");

-- CreateIndex
CREATE INDEX "core_clients_organization_id_name_idx" ON "core_clients"("organization_id", "name");

-- CreateIndex
CREATE INDEX "core_services_organization_id_idx" ON "core_services"("organization_id");

-- CreateIndex
CREATE INDEX "core_services_is_active_idx" ON "core_services"("is_active");

-- CreateIndex
CREATE INDEX "core_contractors_organization_id_idx" ON "core_contractors"("organization_id");

-- CreateIndex
CREATE INDEX "core_contractors_deleted_at_idx" ON "core_contractors"("deleted_at");

-- CreateIndex
CREATE INDEX "core_contractor_assignments_contractor_id_idx" ON "core_contractor_assignments"("contractor_id");

-- CreateIndex
CREATE INDEX "core_contractor_assignments_client_id_idx" ON "core_contractor_assignments"("client_id");

-- CreateIndex
CREATE INDEX "core_contractor_assignments_start_date_end_date_idx" ON "core_contractor_assignments"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "core_client_services_client_id_idx" ON "core_client_services"("client_id");

-- CreateIndex
CREATE INDEX "core_client_services_service_id_idx" ON "core_client_services"("service_id");

-- CreateIndex
CREATE INDEX "financial_revenue_records_organization_id_idx" ON "financial_revenue_records"("organization_id");

-- CreateIndex
CREATE INDEX "financial_revenue_records_client_id_idx" ON "financial_revenue_records"("client_id");

-- CreateIndex
CREATE INDEX "financial_revenue_records_transaction_date_idx" ON "financial_revenue_records"("transaction_date");

-- CreateIndex
CREATE INDEX "financial_revenue_records_sync_source_external_id_idx" ON "financial_revenue_records"("sync_source", "external_id");

-- CreateIndex
CREATE INDEX "financial_revenue_records_revenue_sync_status_idx" ON "financial_revenue_records"("revenue_sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_revenue_records_organization_id_xero_invoice_id_key" ON "financial_revenue_records"("organization_id", "xero_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_expense_records_mercury_transaction_id_key" ON "financial_expense_records"("mercury_transaction_id");

-- CreateIndex
CREATE INDEX "financial_expense_records_organization_id_idx" ON "financial_expense_records"("organization_id");

-- CreateIndex
CREATE INDEX "financial_expense_records_client_id_idx" ON "financial_expense_records"("client_id");

-- CreateIndex
CREATE INDEX "financial_expense_records_contractor_id_idx" ON "financial_expense_records"("contractor_id");

-- CreateIndex
CREATE INDEX "financial_expense_records_agency_id_idx" ON "financial_expense_records"("agency_id");

-- CreateIndex
CREATE INDEX "financial_expense_records_transaction_date_idx" ON "financial_expense_records"("transaction_date");

-- CreateIndex
CREATE INDEX "financial_expense_records_category_idx" ON "financial_expense_records"("category");

-- CreateIndex
CREATE INDEX "financial_expense_records_expense_sync_status_idx" ON "financial_expense_records"("expense_sync_status");

-- CreateIndex
CREATE INDEX "financial_expense_records_mercury_sync_status_idx" ON "financial_expense_records"("mercury_sync_status");

-- CreateIndex
CREATE INDEX "financial_expense_records_mercury_transaction_id_idx" ON "financial_expense_records"("mercury_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_expense_records_organization_id_xero_expense_id_key" ON "financial_expense_records"("organization_id", "xero_expense_id");

-- CreateIndex
CREATE INDEX "analytics_client_metrics_client_id_idx" ON "analytics_client_metrics"("client_id");

-- CreateIndex
CREATE INDEX "analytics_client_metrics_period_start_period_end_idx" ON "analytics_client_metrics"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "analytics_client_metrics_tier_classification_idx" ON "analytics_client_metrics"("tier_classification");

-- CreateIndex
CREATE INDEX "analytics_company_metrics_organization_id_idx" ON "analytics_company_metrics"("organization_id");

-- CreateIndex
CREATE INDEX "analytics_company_metrics_period_start_period_end_idx" ON "analytics_company_metrics"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "integrations_oauth_tokens_expires_at_idx" ON "integrations_oauth_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_oauth_tokens_organization_id_provider_key" ON "integrations_oauth_tokens"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "integrations_sync_logs_organization_id_idx" ON "integrations_sync_logs"("organization_id");

-- CreateIndex
CREATE INDEX "integrations_sync_logs_integration_type_idx" ON "integrations_sync_logs"("integration_type");

-- CreateIndex
CREATE INDEX "integrations_sync_logs_sync_started_at_idx" ON "integrations_sync_logs"("sync_started_at");

-- CreateIndex
CREATE INDEX "integrations_sync_logs_status_idx" ON "integrations_sync_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "xero_connections_organization_id_key" ON "xero_connections"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "xero_connections_xero_tenant_id_key" ON "xero_connections"("xero_tenant_id");

-- CreateIndex
CREATE INDEX "xero_connections_organization_id_idx" ON "xero_connections"("organization_id");

-- CreateIndex
CREATE INDEX "xero_connections_connection_status_idx" ON "xero_connections"("connection_status");

-- CreateIndex
CREATE INDEX "xero_connections_xero_tenant_id_idx" ON "xero_connections"("xero_tenant_id");

-- CreateIndex
CREATE INDEX "xero_sync_logs_connection_id_idx" ON "xero_sync_logs"("connection_id");

-- CreateIndex
CREATE INDEX "xero_sync_logs_status_idx" ON "xero_sync_logs"("status");

-- CreateIndex
CREATE INDEX "xero_sync_logs_started_at_idx" ON "xero_sync_logs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "xero_sync_logs_sync_type_idx" ON "xero_sync_logs"("sync_type");

-- CreateIndex
CREATE INDEX "xero_contact_mappings_connection_id_idx" ON "xero_contact_mappings"("connection_id");

-- CreateIndex
CREATE INDEX "xero_contact_mappings_client_id_idx" ON "xero_contact_mappings"("client_id");

-- CreateIndex
CREATE INDEX "xero_contact_mappings_mapping_type_idx" ON "xero_contact_mappings"("mapping_type");

-- CreateIndex
CREATE UNIQUE INDEX "xero_contact_mappings_connection_id_xero_contact_id_key" ON "xero_contact_mappings"("connection_id", "xero_contact_id");

-- CreateIndex
CREATE INDEX "xero_expense_category_mappings_connection_id_idx" ON "xero_expense_category_mappings"("connection_id");

-- CreateIndex
CREATE INDEX "xero_expense_category_mappings_priority_idx" ON "xero_expense_category_mappings"("priority");

-- CreateIndex
CREATE INDEX "xero_expense_category_mappings_expense_type_idx" ON "xero_expense_category_mappings"("expense_type");

-- CreateIndex
CREATE UNIQUE INDEX "mercury_connections_organization_id_key" ON "mercury_connections"("organization_id");

-- CreateIndex
CREATE INDEX "mercury_connections_organization_id_idx" ON "mercury_connections"("organization_id");

-- CreateIndex
CREATE INDEX "mercury_connections_connection_status_idx" ON "mercury_connections"("connection_status");

-- CreateIndex
CREATE INDEX "mercury_connections_last_sync_at_idx" ON "mercury_connections"("last_sync_at");

-- CreateIndex
CREATE INDEX "mercury_sync_logs_connection_id_idx" ON "mercury_sync_logs"("connection_id");

-- CreateIndex
CREATE INDEX "mercury_sync_logs_status_idx" ON "mercury_sync_logs"("status");

-- CreateIndex
CREATE INDEX "mercury_sync_logs_started_at_idx" ON "mercury_sync_logs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "mercury_sync_logs_sync_type_idx" ON "mercury_sync_logs"("sync_type");

-- CreateIndex
CREATE INDEX "merchant_mapping_cache_connection_id_idx" ON "merchant_mapping_cache"("connection_id");

-- CreateIndex
CREATE INDEX "merchant_mapping_cache_contractor_id_idx" ON "merchant_mapping_cache"("contractor_id");

-- CreateIndex
CREATE INDEX "merchant_mapping_cache_agency_id_idx" ON "merchant_mapping_cache"("agency_id");

-- CreateIndex
CREATE INDEX "merchant_mapping_cache_subscription_id_idx" ON "merchant_mapping_cache"("subscription_id");

-- CreateIndex
CREATE INDEX "merchant_mapping_cache_mapping_confidence_idx" ON "merchant_mapping_cache"("mapping_confidence");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_mapping_cache_connection_id_normalized_merchant_na_key" ON "merchant_mapping_cache"("connection_id", "normalized_merchant_name");

-- CreateIndex
CREATE INDEX "transaction_categorization_rules_organization_id_priority_idx" ON "transaction_categorization_rules"("organization_id", "priority" DESC);

-- CreateIndex
CREATE INDEX "transaction_categorization_rules_organization_id_category_idx" ON "transaction_categorization_rules"("organization_id", "category");

-- CreateIndex
CREATE INDEX "transaction_categorization_rules_is_active_idx" ON "transaction_categorization_rules"("is_active");

-- CreateIndex
CREATE INDEX "account_balance_history_connection_id_idx" ON "account_balance_history"("connection_id");

-- CreateIndex
CREATE INDEX "account_balance_history_snapshot_date_idx" ON "account_balance_history"("snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "account_balance_history_account_type_idx" ON "account_balance_history"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_history_connection_id_mercury_account_id_sn_key" ON "account_balance_history"("connection_id", "mercury_account_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "system_financial_targets_organization_id_idx" ON "system_financial_targets"("organization_id");

-- CreateIndex
CREATE INDEX "system_financial_targets_scope_scope_id_idx" ON "system_financial_targets"("scope", "scope_id");

-- CreateIndex
CREATE INDEX "system_financial_targets_fiscal_period_idx" ON "system_financial_targets"("fiscal_period");

-- CreateIndex
CREATE INDEX "system_growth_scenarios_organization_id_idx" ON "system_growth_scenarios"("organization_id");

-- CreateIndex
CREATE INDEX "system_growth_scenarios_created_at_idx" ON "system_growth_scenarios"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs"("action_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_source_idx" ON "notifications"("source");

-- CreateIndex
CREATE INDEX "notifications_organization_id_status_idx" ON "notifications"("organization_id", "status");

-- CreateIndex
CREATE INDEX "webhook_events_source_idx" ON "webhook_events"("source");

-- CreateIndex
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "webhook_events_organization_id_idx" ON "webhook_events"("organization_id");

-- CreateIndex
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events"("processed");

-- CreateIndex
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "staff_organization_id_idx" ON "staff"("organization_id");

-- CreateIndex
CREATE INDEX "staff_organization_id_staff_type_idx" ON "staff"("organization_id", "staff_type");

-- CreateIndex
CREATE INDEX "staff_agency_id_idx" ON "staff"("agency_id");

-- CreateIndex
CREATE INDEX "staff_assignments_staff_id_idx" ON "staff_assignments"("staff_id");

-- CreateIndex
CREATE INDEX "staff_assignments_client_id_idx" ON "staff_assignments"("client_id");

-- CreateIndex
CREATE INDEX "staff_assignments_staff_id_client_id_idx" ON "staff_assignments"("staff_id", "client_id");

-- CreateIndex
CREATE INDEX "staff_assignments_start_date_end_date_idx" ON "staff_assignments"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_is_active_idx" ON "subscriptions"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "subscription_allocations_subscription_id_idx" ON "subscription_allocations"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_allocations_client_id_idx" ON "subscription_allocations"("client_id");

-- CreateIndex
CREATE INDEX "subscription_allocations_staff_id_idx" ON "subscription_allocations"("staff_id");

-- CreateIndex
CREATE INDEX "agencies_organization_id_idx" ON "agencies"("organization_id");

-- CreateIndex
CREATE INDEX "agency_monthly_breakdowns_agency_id_year_month_idx" ON "agency_monthly_breakdowns"("agency_id", "year", "month" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "agency_monthly_breakdowns_agency_id_month_year_key" ON "agency_monthly_breakdowns"("agency_id", "month", "year");

-- CreateIndex
CREATE INDEX "bdr_productivity_metrics_bdr_id_year_month_idx" ON "bdr_productivity_metrics"("bdr_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "bdr_productivity_metrics_client_id_year_month_idx" ON "bdr_productivity_metrics"("client_id", "year", "month" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bdr_productivity_metrics_bdr_id_client_id_month_year_key" ON "bdr_productivity_metrics"("bdr_id", "client_id", "month", "year");

-- CreateIndex
CREATE INDEX "client_roi_client_id_year_month_idx" ON "client_roi"("client_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "client_roi_margin_percentage_idx" ON "client_roi"("margin_percentage");

-- CreateIndex
CREATE INDEX "client_roi_roi_percentage_idx" ON "client_roi"("roi_percentage");

-- CreateIndex
CREATE UNIQUE INDEX "client_roi_client_id_month_year_key" ON "client_roi"("client_id", "month", "year");

-- CreateIndex
CREATE INDEX "bdr_roi_bdr_id_year_month_idx" ON "bdr_roi"("bdr_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "bdr_roi_roi_percentage_idx" ON "bdr_roi"("roi_percentage");

-- CreateIndex
CREATE INDEX "bdr_roi_margin_percentage_idx" ON "bdr_roi"("margin_percentage");

-- CreateIndex
CREATE UNIQUE INDEX "bdr_roi_bdr_id_month_year_key" ON "bdr_roi"("bdr_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_transaction_records_mercury_transaction_id_key" ON "subscription_transaction_records"("mercury_transaction_id");

-- CreateIndex
CREATE INDEX "subscription_transaction_records_organization_id_idx" ON "subscription_transaction_records"("organization_id");

-- CreateIndex
CREATE INDEX "subscription_transaction_records_subscription_id_period_yea_idx" ON "subscription_transaction_records"("subscription_id", "period_year", "period_month" DESC);

-- CreateIndex
CREATE INDEX "subscription_transaction_records_mercury_transaction_id_idx" ON "subscription_transaction_records"("mercury_transaction_id");

-- CreateIndex
CREATE INDEX "subscription_transaction_records_transaction_date_idx" ON "subscription_transaction_records"("transaction_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_transaction_records_subscription_id_mercury_tr_key" ON "subscription_transaction_records"("subscription_id", "mercury_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_cash_receipts_mercury_transaction_id_key" ON "client_cash_receipts"("mercury_transaction_id");

-- CreateIndex
CREATE INDEX "client_cash_receipts_organization_id_idx" ON "client_cash_receipts"("organization_id");

-- CreateIndex
CREATE INDEX "client_cash_receipts_client_id_period_year_period_month_idx" ON "client_cash_receipts"("client_id", "period_year", "period_month" DESC);

-- CreateIndex
CREATE INDEX "client_cash_receipts_mercury_transaction_id_idx" ON "client_cash_receipts"("mercury_transaction_id");

-- CreateIndex
CREATE INDEX "client_cash_receipts_receipt_date_idx" ON "client_cash_receipts"("receipt_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "client_cash_receipts_client_id_mercury_transaction_id_key" ON "client_cash_receipts"("client_id", "mercury_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "auto_sync_run_logs_mercury_sync_log_id_key" ON "auto_sync_run_logs"("mercury_sync_log_id");

-- CreateIndex
CREATE INDEX "auto_sync_run_logs_organization_id_idx" ON "auto_sync_run_logs"("organization_id");

-- CreateIndex
CREATE INDEX "auto_sync_run_logs_mercury_sync_log_id_idx" ON "auto_sync_run_logs"("mercury_sync_log_id");

-- CreateIndex
CREATE INDEX "auto_sync_run_logs_started_at_idx" ON "auto_sync_run_logs"("started_at" DESC);

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_clients" ADD CONSTRAINT "core_clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_services" ADD CONSTRAINT "core_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_contractors" ADD CONSTRAINT "core_contractors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_contractor_assignments" ADD CONSTRAINT "core_contractor_assignments_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_contractor_assignments" ADD CONSTRAINT "core_contractor_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_client_services" ADD CONSTRAINT "core_client_services_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_client_services" ADD CONSTRAINT "core_client_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_revenue_records" ADD CONSTRAINT "financial_revenue_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_revenue_records" ADD CONSTRAINT "financial_revenue_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_revenue_records" ADD CONSTRAINT "financial_revenue_records_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_client_metrics" ADD CONSTRAINT "analytics_client_metrics_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_company_metrics" ADD CONSTRAINT "analytics_company_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations_oauth_tokens" ADD CONSTRAINT "integrations_oauth_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations_sync_logs" ADD CONSTRAINT "integrations_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_sync_logs" ADD CONSTRAINT "xero_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "xero_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_contact_mappings" ADD CONSTRAINT "xero_contact_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "xero_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_contact_mappings" ADD CONSTRAINT "xero_contact_mappings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_expense_category_mappings" ADD CONSTRAINT "xero_expense_category_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "xero_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercury_connections" ADD CONSTRAINT "mercury_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercury_sync_logs" ADD CONSTRAINT "mercury_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categorization_rules" ADD CONSTRAINT "transaction_categorization_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balance_history" ADD CONSTRAINT "account_balance_history_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_financial_targets" ADD CONSTRAINT "system_financial_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_growth_scenarios" ADD CONSTRAINT "system_growth_scenarios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_allocations" ADD CONSTRAINT "subscription_allocations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_allocations" ADD CONSTRAINT "subscription_allocations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_allocations" ADD CONSTRAINT "subscription_allocations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_monthly_breakdowns" ADD CONSTRAINT "agency_monthly_breakdowns_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdr_productivity_metrics" ADD CONSTRAINT "bdr_productivity_metrics_bdr_id_fkey" FOREIGN KEY ("bdr_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdr_productivity_metrics" ADD CONSTRAINT "bdr_productivity_metrics_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_roi" ADD CONSTRAINT "client_roi_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdr_roi" ADD CONSTRAINT "bdr_roi_bdr_id_fkey" FOREIGN KEY ("bdr_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_transaction_records" ADD CONSTRAINT "subscription_transaction_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_transaction_records" ADD CONSTRAINT "subscription_transaction_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_cash_receipts" ADD CONSTRAINT "client_cash_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_cash_receipts" ADD CONSTRAINT "client_cash_receipts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_sync_run_logs" ADD CONSTRAINT "auto_sync_run_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_sync_run_logs" ADD CONSTRAINT "auto_sync_run_logs_mercury_sync_log_id_fkey" FOREIGN KEY ("mercury_sync_log_id") REFERENCES "mercury_sync_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

