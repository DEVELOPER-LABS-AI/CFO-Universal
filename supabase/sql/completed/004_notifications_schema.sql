-- ============================================================================
-- Unified Notifications System Schema
-- ============================================================================
-- This migration creates tables for a unified notification center that can
-- receive and display notifications from Xero webhooks and other integrations.
--
-- IMPORTANT: Run this script manually in Supabase SQL Editor
-- ============================================================================

-- Create Notification Enums
CREATE TYPE "NotificationType" AS ENUM (
    'XERO_INVOICE_CREATED',
    'XERO_INVOICE_UPDATED',
    'XERO_CONTACT_CREATED',
    'XERO_CONTACT_UPDATED',
    'SYNC_COMPLETED',
    'SYNC_FAILED',
    'INTEGRATION_ERROR',
    'SYSTEM_ALERT',
    'INFO',
    'WARNING',
    'ERROR'
);

CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- ============================================================================
-- Table: notifications
-- Purpose: Store all system notifications from various sources
-- ============================================================================
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organization_id" TEXT NOT NULL REFERENCES "core_organizations"("id") ON DELETE CASCADE,
    "user_id" UUID REFERENCES "auth"."users"("id") ON DELETE CASCADE, -- NULL for org-wide notifications
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "source" VARCHAR(100) NOT NULL, -- 'XERO', 'MERCURY', 'SYSTEM', etc.
    "metadata" JSONB DEFAULT '{}'::jsonb, -- Additional context data
    "action_url" TEXT, -- Optional link to relevant page
    "related_entity_type" VARCHAR(100), -- 'invoice', 'contact', 'sync_log', etc.
    "related_entity_id" TEXT, -- ID of related entity
    "read_at" TIMESTAMP,
    "archived_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX "idx_notifications_org_id" ON "notifications"("organization_id");
CREATE INDEX "idx_notifications_user_id" ON "notifications"("user_id");
CREATE INDEX "idx_notifications_status" ON "notifications"("status");
CREATE INDEX "idx_notifications_type" ON "notifications"("type");
CREATE INDEX "idx_notifications_priority" ON "notifications"("priority");
CREATE INDEX "idx_notifications_created_at" ON "notifications"("created_at" DESC);
CREATE INDEX "idx_notifications_source" ON "notifications"("source");
CREATE INDEX "idx_notifications_org_status" ON "notifications"("organization_id", "status");

-- ============================================================================
-- Table: webhook_events
-- Purpose: Store raw webhook payloads for debugging and audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "source" VARCHAR(100) NOT NULL, -- 'XERO', 'MERCURY', etc.
    "event_type" VARCHAR(255) NOT NULL,
    "organization_id" TEXT REFERENCES "core_organizations"("id") ON DELETE CASCADE,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "signature" TEXT, -- Webhook signature for verification
    "processed" BOOLEAN NOT NULL DEFAULT FALSE,
    "processed_at" TIMESTAMP,
    "processing_error" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX "idx_webhook_events_source" ON "webhook_events"("source");
CREATE INDEX "idx_webhook_events_event_type" ON "webhook_events"("event_type");
CREATE INDEX "idx_webhook_events_org_id" ON "webhook_events"("organization_id");
CREATE INDEX "idx_webhook_events_processed" ON "webhook_events"("processed");
CREATE INDEX "idx_webhook_events_created_at" ON "webhook_events"("created_at" DESC);

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Notifications schema created successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run the RLS policies script: 005_notifications_rls_policies.sql';
    RAISE NOTICE '2. Deploy the webhook endpoint';
    RAISE NOTICE '3. Configure webhook URLs in Xero';
END $$;
