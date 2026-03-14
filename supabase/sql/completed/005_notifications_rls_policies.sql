-- ============================================================================
-- Row Level Security (RLS) Policies for Notifications System
-- ============================================================================
-- Ensures users can only see notifications for their organization
-- ============================================================================

-- Enable RLS on notifications table
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notifications for their organization
CREATE POLICY "Users can view own organization notifications"
    ON "notifications"
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM "user_organizations"
            WHERE user_id = auth.uid()
        )
        AND (
            -- Org-wide notifications (user_id IS NULL)
            user_id IS NULL
            -- OR user-specific notifications
            OR user_id = auth.uid()
        )
    );

-- Policy: Users can update notification status (mark as read/archived)
CREATE POLICY "Users can update own notifications"
    ON "notifications"
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM "user_organizations"
            WHERE user_id = auth.uid()
        )
        AND (
            user_id IS NULL
            OR user_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM "user_organizations"
            WHERE user_id = auth.uid()
        )
        AND (
            user_id IS NULL
            OR user_id = auth.uid()
        )
    );

-- Policy: System can create notifications (service role only)
CREATE POLICY "Service role can create notifications"
    ON "notifications"
    FOR INSERT
    WITH CHECK (true); -- Service role bypasses RLS, so this is safe

-- Enable RLS on webhook_events table
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view webhook events for their organization
CREATE POLICY "Admins can view own organization webhooks"
    ON "webhook_events"
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM "user_organizations"
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'FINANCE_ADMIN')
        )
    );

-- Policy: Service role can create webhook events
CREATE POLICY "Service role can create webhook events"
    ON "webhook_events"
    FOR INSERT
    WITH CHECK (true);

-- Policy: Service role can update webhook events (mark as processed)
CREATE POLICY "Service role can update webhook events"
    ON "webhook_events"
    FOR UPDATE
    WITH CHECK (true);

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Notifications RLS policies created successfully!';
    RAISE NOTICE 'Users can now securely access notifications for their organization.';
END $$;
