/**
 * Setup pg_cron for Daily Xero Sync
 *
 * Schedules automatic daily sync at 2 AM UTC for all active Xero connections.
 *
 * Prerequisites:
 * - pg_cron extension must be enabled in Supabase dashboard
 * - Run this SQL in Supabase SQL Editor
 *
 * @see https://supabase.com/docs/guides/database/extensions/pg_cron
 */

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if exists (for idempotency)
SELECT cron.unschedule('xero-daily-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'xero-daily-sync'
);

-- Schedule daily Xero sync at 2 AM UTC
-- This calls the Edge Function /api/xero/sync/scheduled which processes all active connections
SELECT cron.schedule(
  'xero-daily-sync',  -- Job name
  '0 2 * * *',        -- Cron expression: Every day at 2:00 AM UTC
  $$
    -- Call the scheduled sync endpoint for each active Xero connection
    -- This uses Supabase's pg_net extension to make HTTP requests
    SELECT
      net.http_post(
        url := 'https://' || current_setting('app.vercel_url') || '/api/xero/sync/scheduled',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.cron_secret')
        ),
        body := jsonb_build_object(
          'connection_id', connection_id,
          'organization_id', organization_id
        )
      ) AS request_id
    FROM (
      SELECT
        id AS connection_id,
        organization_id
      FROM xero_connections
      WHERE connection_status = 'ACTIVE'
        AND token_expiry > NOW() + INTERVAL '1 hour'
    ) active_connections;
  $$
);

-- Verify job was created
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'xero-daily-sync';

/*
 * Alternative: Use Vercel Cron (Recommended for Vercel deployments)
 *
 * Instead of pg_cron, you can use Vercel Cron Jobs which are more reliable for Vercel-hosted apps:
 *
 * 1. Create /api/xero/sync/cron/route.ts:
 *
 *    export async function GET(request: Request) {
 *      // Verify cron secret
 *      const authHeader = request.headers.get('authorization');
 *      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 *        return new Response('Unauthorized', { status: 401 });
 *      }
 *
 *      // Process all active connections
 *      const connections = await prisma.xeroConnection.findMany({
 *        where: { connection_status: 'ACTIVE' }
 *      });
 *
 *      for (const connection of connections) {
 *        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/xero/sync`, {
 *          method: 'POST',
 *          headers: { 'Content-Type': 'application/json' },
 *          body: JSON.stringify({
 *            connection_id: connection.id,
 *            sync_type: 'FULL'
 *          })
 *        });
 *      }
 *
 *      return Response.json({ success: true });
 *    }
 *
 * 2. Add to vercel.json:
 *
 *    {
 *      "crons": [{
 *        "path": "/api/xero/sync/cron",
 *        "schedule": "0 2 * * *"
 *      }]
 *    }
 *
 * 3. Set CRON_SECRET in Vercel environment variables
 */
